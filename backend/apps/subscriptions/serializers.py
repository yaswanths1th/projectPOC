# backend/apps/subscriptions/serializers.py
from django.apps import apps
from django.contrib.auth import get_user_model
from rest_framework import serializers
from django.db import transaction, connection
from django.utils import timezone

User = get_user_model()

# Helper: try multiple app labels to find models robustly
def find_model(candidates, model_name):
    for cand in candidates:
        try:
            return apps.get_model(cand, model_name)
        except LookupError:
            continue
    # fallback common labels
    for cand in ["subscriptions", "apps.subscriptions", "apps.subscriptions.models"]:
        try:
            return apps.get_model(cand, model_name)
        except LookupError:
            continue
    raise LookupError(f"Model {model_name} not found in app labels {candidates}")

def create_serializers():
    app_candidates = ["apps.subscriptions", "subscriptions", "apps.subscriptions.models"]

    Plan = None
    UserSubscription = None
    SubscriptionPlan = None

    # Try Plan and SubscriptionPlan name variants
    try:
        Plan = find_model(app_candidates, "Plan")
    except LookupError:
        try:
            Plan = find_model(app_candidates, "SubscriptionPlan")
        except LookupError:
            Plan = None

    try:
        UserSubscription = find_model(app_candidates, "UserSubscription")
    except LookupError:
        UserSubscription = None

    try:
        SubscriptionPlan = find_model(app_candidates, "SubscriptionPlan")
    except LookupError:
        SubscriptionPlan = Plan

    # Plan serializer
    if Plan is None:
        class PlanSerializerDummy(serializers.Serializer):
            id = serializers.IntegerField(read_only=True)
            slug = serializers.CharField()
            name = serializers.CharField()
            description = serializers.CharField(allow_blank=True, required=False)
            price_cents = serializers.IntegerField(required=False, allow_null=True)
            interval = serializers.CharField(required=False, allow_null=True)
            can_use_ai = serializers.BooleanField(default=False)
            can_edit_profile = serializers.BooleanField(default=False)
            can_change_password = serializers.BooleanField(default=False)
            is_active = serializers.BooleanField(default=True)
        PlanSerializerCls = PlanSerializerDummy
    else:
        class PlanSerializerCls(serializers.ModelSerializer):
            class Meta:
                model = Plan
                fields = [
                    'id', 'slug', 'name', 'description', 'price_cents',
                    'interval', 'can_use_ai', 'can_edit_profile', 'can_change_password', 'is_active'
                ]

    # minimal subscription plan serializer
    if SubscriptionPlan is None:
        class SubscriptionPlanMinimalSerializer(serializers.Serializer):
            id = serializers.IntegerField(read_only=True)
            slug = serializers.CharField()
            name = serializers.CharField()
            price_cents = serializers.IntegerField(required=False, allow_null=True)
    else:
        class SubscriptionPlanMinimalSerializer(serializers.ModelSerializer):
            class Meta:
                model = SubscriptionPlan
                fields = ("id", "slug", "name", "price_cents")

    # user subscription serializer
    if UserSubscription is None:
        class UserSubscriptionSerializer(serializers.Serializer):
            id = serializers.IntegerField(read_only=True)
            user_id = serializers.IntegerField()
            plan_id = serializers.IntegerField(required=False, allow_null=True)
            plan = SubscriptionPlanMinimalSerializer(required=False, allow_null=True)
            plan_slug = serializers.CharField(required=False, allow_null=True)
            status = serializers.CharField(required=False, allow_null=True)
            active = serializers.BooleanField(default=True)
            started_at = serializers.DateTimeField(required=False, allow_null=True)
            end_date = serializers.DateTimeField(required=False, allow_null=True)
            auto_renew = serializers.BooleanField(default=False)
            payment_provider = serializers.CharField(required=False, allow_null=True)
            payment_reference = serializers.CharField(required=False, allow_null=True)
            created_at = serializers.DateTimeField(required=False, allow_null=True)
            updated_at = serializers.DateTimeField(required=False, allow_null=True)
    else:
        class UserSubscriptionSerializer(serializers.ModelSerializer):
            plan = SubscriptionPlanMinimalSerializer(source="plan", read_only=True)
            plan_slug = serializers.SerializerMethodField()

            class Meta:
                model = UserSubscription
                # use field name 'active' because model uses that; include backward compat if needed
                fields = (
                    "id",
                    "user_id",
                    "plan",
                    "plan_id",
                    "plan_slug",
                    "status",
                    "active",
                    "started_at",
                    "end_date",
                    "auto_renew",
                    "payment_provider",
                    "payment_reference",
                    "created_at",
                    "updated_at",
                )

            def get_plan_slug(self, obj):
                try:
                    return obj.plan.slug
                except Exception:
                    return None

    # user profile serializer (exposes subscription)
    class UserProfileSerializer(serializers.ModelSerializer):
        subscription = serializers.SerializerMethodField()

        class Meta:
            model = User
            fields = ('id', 'username', 'first_name', 'last_name', 'email', 'is_staff', 'is_active', 'date_joined', 'subscription')

        def get_subscription(self, obj):
            sub = None
            try:
                if hasattr(obj, "subscriptions"):
                    try:
                        sub = obj.subscriptions.filter(active=True).order_by('-started_at', '-created_at').first()
                    except Exception:
                        sub = obj.subscriptions.order_by('-started_at', '-created_at').first()
                else:
                    if UserSubscription is not None:
                        # try filter by active or is_active
                        try:
                            sub = UserSubscription.objects.filter(user_id=obj.id, active=True).order_by('-started_at', '-created_at').first()
                        except Exception:
                            sub = UserSubscription.objects.filter(user_id=obj.id).order_by('-started_at', '-created_at').first()
            except Exception:
                sub = None

            if not sub:
                return None

            plan = getattr(sub, "plan", None)
            def safe_get(o, a, d=None):
                try:
                    return getattr(o, a, d)
                except Exception:
                    return d

            started = safe_get(sub, "started_at", None) or safe_get(sub, "start_date", None)
            expires = safe_get(sub, "end_date", None) or safe_get(sub, "expires_at", None)
            active_flag = bool(safe_get(sub, "active", safe_get(sub, "is_active", True)))

            return {
                'id': safe_get(sub, "id", None),
                'slug': safe_get(plan, "slug", None),
                'name': safe_get(plan, "name", None),
                'is_active': active_flag,
                'started_at': started.isoformat() if started else None,
                'expires_at': expires.isoformat() if expires else None,
                'can_edit_profile': bool(safe_get(plan, "can_edit_profile", False)),
                'can_change_password': bool(safe_get(plan, "can_change_password", False)),
                'can_use_ai': bool(safe_get(plan, "can_use_ai", False)),
                'price_cents': safe_get(plan, "price_cents", None)
            }

    # CreateSubscriptionSerializer: validate and create using 'active' field name
    class CreateSubscriptionSerializer(serializers.Serializer):
        plan_slug = serializers.CharField()
        payment_provider = serializers.CharField(required=False, allow_blank=True)
        payment_reference = serializers.CharField(required=False, allow_blank=True)
        auto_renew = serializers.BooleanField(required=False, default=False)
        start_date = serializers.DateTimeField(required=False, allow_null=True)
        end_date = serializers.DateTimeField(required=False, allow_null=True)

        def validate_plan_slug(self, value):
            model_to_check = SubscriptionPlan or Plan
            if model_to_check is None:
                raise serializers.ValidationError("Subscription model not available on the server")
            try:
                model_to_check.objects.get(slug=value)
            except Exception:
                raise serializers.ValidationError("Invalid plan slug")
            return value

        def create(self, validated_data):
            request = self.context.get("request")
            if not request or not request.user or not request.user.is_authenticated:
                raise serializers.ValidationError("Authentication required")

            user = request.user

            # Resolve models robustly (we use the dynamic model resolution in the file)
            UserSubscription = None
            try:
                UserSubscription = apps.get_model("apps.subscriptions", "UserSubscription")
            except LookupError:
                try:
                    UserSubscription = apps.get_model("subscriptions", "UserSubscription")
                except LookupError:
                    UserSubscription = None

            SubscriptionPlan = None
            try:
                SubscriptionPlan = apps.get_model("apps.subscriptions", "SubscriptionPlan")
            except LookupError:
                try:
                    SubscriptionPlan = apps.get_model("subscriptions", "SubscriptionPlan")
                except LookupError:
                    SubscriptionPlan = None

            PlanModel = SubscriptionPlan or getattr(self, "Plan", None)
            if PlanModel is None:
                # try fallback Plan model name
                try:
                    PlanModel = apps.get_model("apps.subscriptions", "Plan")
                except LookupError:
                    try:
                        PlanModel = apps.get_model("subscriptions", "Plan")
                    except LookupError:
                        PlanModel = None

            if PlanModel is None or UserSubscription is None:
                raise serializers.ValidationError("Subscription models are not configured on the server")

            # Resolve the requested plan
            try:
                plan = PlanModel.objects.get(slug=validated_data["plan_slug"])
            except PlanModel.DoesNotExist:
                raise serializers.ValidationError("Invalid plan slug")

            now = timezone.now()

            # Use transaction to ensure consistent state
            with transaction.atomic():
                # 1) Deactivate any existing active subscriptions for this user
                # try the 'active' field (primary in your DB); fall back to 'is_active'
                updated_count = 0
                try:
                    updated_count = UserSubscription.objects.filter(user_id=user.id, active=True).update(active=False, status="expired", expires_at=now, updated_at=now)
                except Exception:
                    try:
                        updated_count = UserSubscription.objects.filter(user_id=user.id, is_active=True).update(is_active=False, status="expired", expires_at=now, updated_at=now)
                    except Exception:
                        # If neither field exists, try best-effort update of any rows
                        UserSubscription.objects.filter(user_id=user.id).update(status="expired", updated_at=now)

                # 2) Create a new subscription (explicit create is clearer than update_or_create)
                create_kwargs = {
                    "user_id": user.id,
                    "plan_id": plan.id,
                    "status": "active",
                    # use 'active' if model has it; we'll set both keys defensively if model accepts them
                    "active": True,
                    "start_date": validated_data.get("start_date") or now,
                    "end_date": validated_data.get("end_date"),
                    "auto_renew": validated_data.get("auto_renew", False),
                    "payment_provider": validated_data.get("payment_provider"),
                    "payment_reference": validated_data.get("payment_reference"),
                }

                # Remove keys that model may not accept by trying to create and catching field errors
                try:
                    sub = UserSubscription.objects.create(**create_kwargs)
                except TypeError:
                    # remove 'active' and try 'is_active'
                    create_kwargs.pop("active", None)
                    try:
                        create_kwargs["is_active"] = True
                    except Exception:
                        pass
                    sub = UserSubscription.objects.create(**create_kwargs)

            # Return the created subscription object (the view will serialize and also return updated user)
            return sub
    return (
        PlanSerializerCls,
        SubscriptionPlanMinimalSerializer,
        UserSubscriptionSerializer,
        UserProfileSerializer,
        CreateSubscriptionSerializer,
    )

PlanSerializer, SubscriptionPlanMinimalSerializer, UserSubscriptionSerializer, UserProfileSerializer, CreateSubscriptionSerializer = create_serializers()
