# backend/apps/accounts/serializers.py
from rest_framework import serializers
from .models import User, Department, Role


# ---------- Department ----------
class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'department_name', 'is_active']
        extra_kwargs = {"is_active": {"required": False}}


# ---------- Role ----------
class RoleSerializer(serializers.ModelSerializer):
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all())

    class Meta:
        model = Role
        fields = ['id', 'role_name', 'department', 'is_active']
        extra_kwargs = {"is_active": {"required": False}}


# ---------- User ----------
class UserSerializer(serializers.ModelSerializer):
    # Include readable fields
    role_name = serializers.CharField(source="role.role_name", read_only=True)
    department_name = serializers.CharField(source="department.department_name", read_only=True)

    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(), allow_null=True
    )
    role = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(), allow_null=True
    )

    # Add subscription field
    subscription = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "email",
            "phone",
            "is_active",
            "date_joined",
            "department",
            "department_name",
            "role",
            "role_name",
            "subscription",   # include subscription in profile payload
        ]
        read_only_fields = ["id", "date_joined"]

    def _get_user_subscription_models(self):
        """
        Try to import subscription models. Return tuple (UserSubscriptionModel, PlanModel)
        or (None, None) if not available.
        """
        try:
            from apps.subscriptions.models import UserSubscription, Plan as SubscriptionPlan
            return UserSubscription, SubscriptionPlan
        except Exception:
            # try alternative names / app labels if needed
            try:
                from django.apps import apps
                us = apps.get_model("apps.subscriptions", "UserSubscription")
                pl = apps.get_model("apps.subscriptions", "Plan")
                return us, pl
            except Exception:
                return None, None

    def get_subscription(self, obj):
        """
        Return a canonical subscription dict for given user object.
        Uses UserSubscription.active (preferred) or falls back if different naming exists.
        """
        UserSubscription, SubscriptionPlan = self._get_user_subscription_models()
        if not UserSubscription:
            return None

        sub = None
        # Try common active field names defensively
        try:
            # Try 'active' (your current model)
            sub = UserSubscription.objects.filter(user_id=obj.id, active=True).order_by("-started_at", "-created_at").first()
        except Exception:
            try:
                # Fallback to 'is_active' if some DB has that column
                sub = UserSubscription.objects.filter(user_id=obj.id, is_active=True).order_by("-started_at", "-created_at").first()
            except Exception:
                # Last resort: get latest entry regardless of active flag
                sub = UserSubscription.objects.filter(user_id=obj.id).order_by("-started_at", "-created_at").first()

        if not sub:
            return None

        # Safely extract plan information
        plan = getattr(sub, "plan", None)
        plan_slug = plan.slug if plan and getattr(plan, "slug", None) else None
        plan_name = plan.name if plan and getattr(plan, "name", None) else None
        price_cents = getattr(plan, "price_cents", None) if plan else None

        # Normalize started/expiry names across possible schema differences
        started = getattr(sub, "started_at", None) or getattr(sub, "start_date", None) or None
        expires = getattr(sub, "expires_at", None) or getattr(sub, "end_date", None) or None

        # Prefer explicit 'active' field, fall back to is_active, then True
        active_flag = bool(getattr(sub, "active", getattr(sub, "is_active", True)))

        return {
            "id": getattr(sub, "id", None),
            "plan_id": getattr(sub, "plan_id", None),
            "plan_slug": plan_slug,
            "name": plan_name,
            "status": getattr(sub, "status", None) or getattr(sub, "state", None),
            # keep both keys for compatibility (frontend expects is_active in older code)
            "is_active": active_flag,
            "active": active_flag,
            "start_date": started.isoformat() if started else None,
            "end_date": expires.isoformat() if expires else None,
            "auto_renew": bool(getattr(sub, "auto_renew", False)),
            "payment_provider": getattr(sub, "payment_provider", None),
            "payment_reference": getattr(sub, "payment_reference", None),
            "price_cents": price_cents,
        }

# ---------- Register ----------
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "phone", "password",
            "first_name", "last_name", "department", "role",
        ]

    def validate(self, data):
        if User.objects.filter(username__iexact=data["username"]).exists():
            raise serializers.ValidationError({"username": "EP016"})
        if User.objects.filter(email__iexact=data["email"]).exists():
            raise serializers.ValidationError({"email": "ES003"})
        return data

    def create(self, validated_data):
        password = validated_data.pop("password", None)

        if not validated_data.get("department"):
            validated_data["department"] = Department.objects.filter(
                department_name__iexact="General", is_active=True
            ).first()

        if not validated_data.get("role") and validated_data.get("department"):
            validated_data["role"] = Role.objects.filter(
                role_name__iexact="User",
                department=validated_data["department"],
                is_active=True,
            ).first()

        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user
