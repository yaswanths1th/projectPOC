# backend/apps/accounts/serializers.py

from rest_framework import serializers
from .models import User, Department, Role

# Subscriptions models
from apps.subscriptions.models import UserSubscription, SubscriptionPlan,get_features_for_plan



# ---------- Department ----------

class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "department_name", "is_active"]
        extra_kwargs = {"is_active": {"required": False}}


# ---------- Role ----------

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

    # ---- permissions helper ----

    def get_permissions(self, obj):
        """
        Returns user permissions as a flat list of strings.
        Tries both custom M2M 'permissions' and Django's built-in permissions.
        """
        perms_attr = getattr(obj, "permissions", None)

        # If custom M2M exists
        if perms_attr is not None and hasattr(perms_attr, "all"):
            result = []
            for p in perms_attr.all():
                if hasattr(p, "code"):
                    result.append(p.code)
                elif hasattr(p, "codename"):
                    result.append(p.codename)
            return result

        # Fallback: built-in Django permissions
        try:
            return list(obj.get_all_permissions())
        except Exception:
            return []

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



# ---------- Profile (used for /api/auth/profile/) ----------

class ProfileSerializer(BaseUserSerializer):
    """
    Detailed profile payload for the logged-in user.
    This is what your frontend's UserContext should use.
    """

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
            "is_admin",
            "is_staff",
            "is_superuser",
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
    """
    Generic user serializer (e.g. for admin listing users).
    Still exposes subscription field so UI is consistent.
    """

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
            "permissions",
            "subscription",
            "date_joined",
        ]
        read_only_fields = ["id", "date_joined"]


# ---------- Register ----------

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

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
        ]

    def validate(self, data):
        if User.objects.filter(username__iexact=data["username"]).exists():
            # your earlier codes: "EP016" etc.
            raise serializers.ValidationError({"username": "EP016"})
        if User.objects.filter(email__iexact=data["email"]).exists():
            raise serializers.ValidationError({"email": "ES003"})
        return data

    def create(self, validated_data):
        password = validated_data.pop("password", None)

        # Default department: "General"
        if not validated_data.get("department"):
            validated_data["department"] = Department.objects.filter(
                department_name__iexact="General",
                is_active=True,
            ).first()

        # Default role: "User" in that department
        if not validated_data.get("role") and validated_data.get("department"):
            validated_data["role"] = Role.objects.filter(
                role_name__iexact="User",
                department=validated_data["department"],
                is_active=True,
            ).first()

        user = User(**validated_data)
        if password:
            user.set_password(password)
        user.save()
        return user
