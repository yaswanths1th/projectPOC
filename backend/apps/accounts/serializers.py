# backend/apps/accounts/serializers.py

from rest_framework import serializers
from .models import User, Department, Role, Tenant

from .models_permissions import get_effective_permissions, DepartmentPermission


# ---------- Department ----------

from apps.subscriptions.models import (
    UserSubscription,
    SubscriptionPlan,
    get_features_for_plan,
)

from apps.subscriptions.services.usage_service import consume_resource

# ============================================================
#  Department Serializer (Tenant-Aware)
# ============================================================

class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "department_name", "is_active"]
        extra_kwargs = {"is_active": {"required": False}}


# ============================================================
#  Role Serializer (Tenant-Aware)
# ============================================================

class RoleSerializer(serializers.ModelSerializer):
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all())

    class Meta:
        model = Role
        fields = ["id", "role_name", "department", "is_active"]
        extra_kwargs = {"is_active": {"required": False}}


# ---------- Common helpers for Profile/User ----------

class BaseUserSerializer(serializers.ModelSerializer):
    """
    Base serializer that exposes:
      - department_id / department_name
      - role_id / role_name
      - permissions (as a list of strings)
      - subscription (current plan info)
    """

    department_id = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()

    role_id = serializers.SerializerMethodField()
    role_name = serializers.SerializerMethodField()

    permissions = serializers.SerializerMethodField()
    subscription = serializers.SerializerMethodField()
    is_department_admin = serializers.SerializerMethodField()


    class Meta:
        model = User
        # concrete subclasses override fields
        fields = []

    # ---- department / role helpers ----

    def get_department_id(self, obj):
        dept = getattr(obj, "department", None)
        return dept.id if dept else None

    def get_department_name(self, obj):
        dept = getattr(obj, "department", None)
        return getattr(dept, "department_name", None) if dept else None

    def get_role_id(self, obj):
        r = getattr(obj, "role", None)
        return r.id if r else None

    def get_role_name(self, obj):
        r = getattr(obj, "role", None)
        return getattr(r, "role_name", None) if r else None

    def get_permissions(self, obj):
        """
        Returns effective permissions resolved via:
        UserOverride > Role > Department > Superadmin
        """
        return get_effective_permissions(obj)
    
    def get_is_department_admin(self, obj):
        if not obj.department_id:
            return False

        return DepartmentPermission.objects.filter(
            department_id=obj.department_id
        ).exists()



    # ---- subscription helper ----

    def get_subscription(self, obj):
        """
        Single source of truth for current subscription for /api/auth/profile/.
        Uses subscriptions_usersubscription table + feature matrix table.
        """

        sub = (
            UserSubscription.objects
            .select_related("plan")
            .filter(user=obj, active=True)
            .order_by("-started_at")
            .first()
        )

        if sub and sub.plan:
            plan = sub.plan
            features = get_features_for_plan(plan.slug)

            return {
                "id": sub.id,
                "slug": plan.slug,
                "name": plan.name,
                "status": sub.status,
                "active": sub.active,
                "started_at": sub.started_at,
                "expires_at": sub.expires_at,
                "price_cents": plan.price_cents,
                "features": features,
                "can_use_ai": bool(features.get("can_use_ai", False)),
                "can_edit_profile": bool(features.get("can_edit_profile", True)),
                "can_change_password": bool(features.get("can_change_password", True)),
                "max_projects": features.get("max_projects"),
            }

        # No active subscription → fallback to free plan if present
        free = SubscriptionPlan.objects.filter(slug="free", is_active=True).first()
        if free:
            features = get_features_for_plan("free")
            return {
                "id": None,
                "slug": free.slug,
                "name": free.name,
                "status": "free",
                "active": True,
                "started_at": None,
                "expires_at": None,
                "price_cents": free.price_cents,
                "features": features,
                "can_use_ai": bool(features.get("can_use_ai", False)),
                "can_edit_profile": bool(features.get("can_edit_profile", True)),
                "can_change_password": bool(features.get("can_change_password", True)),
                "max_projects": features.get("max_projects"),
            }

        # Final hard-coded emergency fallback
        return {
            "id": None,
            "slug": "free",
            "name": "Free",
            "status": "free",
            "active": True,
            "started_at": None,
            "expires_at": None,
            "price_cents": 0,
            "features": {
                "can_use_ai": False,
                "can_edit_profile": True,
                "can_change_password": True,
                "max_projects": 1,
            },
            "can_use_ai": False,
            "can_edit_profile": True,
            "can_change_password": True,
            "max_projects": 1,
        }




# ============================================================
#  Profile Serializer
# ============================================================

class ProfileSerializer(BaseUserSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "phone",
            "department",
            "department_id",
            "department_name",
            "role",
            "role_id",
            "role_name",
            "is_active",
            "is_staff",
            "is_superuser",
            "is_superadmin",     # ✅ ADD
            "is_tenant_admin",

            "is_department_admin",  # ✅ ADD THIS LINE

            "permissions",
            "subscription",
            "date_joined",
        ]
        

        read_only_fields = [
            "id",
            "is_active",
            "is_admin",
            "is_staff",
            "is_superuser",
            "date_joined",
        ]


# ---------- User (generic, e.g. for admin list APIs) ----------

class UserSerializer(BaseUserSerializer):
    tenant_id = serializers.SerializerMethodField()
    tenant_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "phone",

            # ✅ TENANT
            "tenant_id",
            "tenant_name",

            # ✅ DEPARTMENT / ROLE
            "department",
            "department_id",
            "department_name",
            "role",
            "role_id",
            "role_name",

            # ✅ FLAGS
            "is_active",
            "is_superadmin",
            "is_tenant_admin",

            "permissions",
            "subscription",
            "date_joined",
        ]
        read_only_fields = ["id", "date_joined"]

    def get_tenant_id(self, obj):
        return obj.tenant_id

    def get_tenant_name(self, obj):
        return obj.tenant.name if obj.tenant else None

# ---------- Register ----------
# ============================================================
#  Register Serializer (Tenant-Aware)
# ============================================================

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    invite_code = serializers.CharField(required=False)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "phone",
            "password",
            "first_name",
            "last_name",
            "department",
            "role",
            "invite_code",
        ]

    def validate(self, data):
        if User.objects.filter(username__iexact=data["username"]).exists():
            # your earlier codes: "EP016" etc.
            raise serializers.ValidationError({"username": "EP016"})
        if User.objects.filter(email__iexact=data["email"]).exists():
            raise serializers.ValidationError({"email": "ES003"})
        return data

    def create(self, validated_data):
        from .models import Tenant, UserInvite
        password = validated_data.pop("password")
        
        invite_code = validated_data.pop("invite_code", None)

        # Default department: "General"
        if not validated_data.get("department"):
            validated_data["department"] = Department.objects.filter(
                department_name__iexact="General",
                is_active=True,
            ).first()

        # Default role: "User" in that department
        if invite_code:
            try:
                invite = UserInvite.objects.get(code=invite_code, used=False)
            except UserInvite.DoesNotExist:
                raise serializers.ValidationError({"invite_code": "INVITE_INVALID"})
            if invite.expires_at < timezone.now():
                raise serializers.ValidationError({"invite_code": "INVITE_EXPIRED"})

            tenant = invite.tenant
            validated_data["tenant"] = tenant
            validated_data["email"] = invite.email  # enforce invited email
            # role/department fallback within tenant
            if not validated_data.get("department"):
                validated_data["department"] = Department.objects.filter(
                    tenant=tenant, department_name__iexact="General"
                ).first()
            if not validated_data.get("role") and validated_data.get("department"):
                validated_data["role"] = Role.objects.filter(
                    tenant=tenant, role_name__iexact="User", department=validated_data["department"]
                ).first()

            user = User(**validated_data)
            user.set_password(password)
            user.save()

            invite.used = True
            invite.save()
            return user

    # else: previous default flow - assign default tenant
        tenant = Tenant.objects.filter(slug="default").first()
        validated_data["tenant"] = tenant
        if not validated_data.get("department"):
            validated_data["department"] = Department.objects.filter(
                tenant=tenant, department_name__iexact="General"
            ).first()
        if not validated_data.get("role") and validated_data.get("department"):
            validated_data["role"] = Role.objects.filter(
                tenant=tenant,
                role_name__iexact="User",
                department=validated_data["department"],
            ).first()

        user = User(**validated_data)
        if password:
            user.set_password(password)
        user.save()
        return user


# Invite serializer
class InviteCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    expires_days = serializers.IntegerField(default=3)

class InviteValidateSerializer(serializers.Serializer):
    code = serializers.CharField()

class InviteAcceptSerializer(serializers.Serializer):
    code = serializers.CharField()
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)

    def validate(self, data):
        code = data.get("code")
        try:
            invite = UserInvite.objects.get(code=code, used=False)
        except UserInvite.DoesNotExist:
            raise serializers.ValidationError({"code": "INVITE_INVALID"})
        if invite.expires_at < timezone.now():
            raise serializers.ValidationError({"code": "INVITE_EXPIRED"})
        data["invite_obj"] = invite
        return data

    def create(self, validated_data):
        invite = validated_data["invite_obj"]
        password = validated_data["password"]
        first_name = validated_data.get("first_name", "")
        last_name = validated_data.get("last_name", "")

        # create user with tenant from invite
        user = User(
            username=invite.email.split("@")[0] + uuid.uuid4().hex[:6],  # or force unique username policy
            email=invite.email,
            tenant=invite.tenant,
            first_name=first_name,
            last_name=last_name,
            is_tenant_admin=False,
        )
        user.set_password(password)
        user.save()

        # mark invite used
        invite.used = True
        invite.save()
        return user

class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = "__all__"

class TenantAdminCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "password",
            "tenant",
        ]

    def create(self, validated_data):
        password = validated_data.pop("password")
        tenant = validated_data["tenant"]

        # Create tenant admin user
        user = User(
            username=validated_data["username"],
            email=validated_data["email"],
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
            tenant=tenant,
            is_tenant_admin=True,
            is_superadmin=False,
            is_staff=True,  # Required for DRF admin permission check
        )

        user.set_password(password)
        user.save()

        # Assign default admin role in GENERAL department
        general_dept = Department.objects.filter(tenant=tenant, department_name="General").first()
        if general_dept:
            user.department = general_dept
            admin_role = Role.objects.filter(
                tenant=tenant,
                department=general_dept,
                role_name__iexact="Admin"
            ).first()
            user.role = admin_role
            user.save()

        return user

class AdminUserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "first_name",
            "last_name",
            "password",
            "tenant",
            "department",
            "role",
            "is_active",
        ]

    def validate(self, data):
        tenant = data.get("tenant")

        # 🔥 SaaS LIMIT ENFORCEMENT
        if tenant:
            result = consume_resource(
                tenant=tenant,
                resource_key="users",
                delta=1
            )
            self.context["usage_warning"] = result.get("warning", False)

        department = data.get("department")
        role = data.get("role")

        if department and department.tenant_id != tenant.id:
            raise serializers.ValidationError("Invalid department")

        if role and role.tenant_id != tenant.id:
            raise serializers.ValidationError("Invalid role")

        return data

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user
