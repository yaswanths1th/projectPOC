# backend/apps/subscriptions/serializers.py

from rest_framework import serializers
from .models import SubscriptionPlan, UserSubscription, get_features_for_plan


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    features = serializers.SerializerMethodField()

    class Meta:
        model = SubscriptionPlan
        fields = [
            "id",
            "slug",
            "name",
            "description",
            "price_cents",
            "currency",
            "billing_cycle",
            "interval",
            "is_active",
            "features",
        ]

    def get_features(self, obj):
        return get_features_for_plan(obj.slug)


# 🔹 Alias to keep old imports working (PlanSerializer)
class PlanSerializer(SubscriptionPlanSerializer):
    class Meta(SubscriptionPlanSerializer.Meta):
        pass


class UserSubscriptionSerializer(serializers.ModelSerializer):
    plan = SubscriptionPlanSerializer(read_only=True)
    features = serializers.SerializerMethodField()

    class Meta:
        model = UserSubscription
        fields = [
            "id",
            "plan",
            "started_at",
            "expires_at",
            "active",
            "status",
            "payment_provider",
            "payment_reference",
            "features",
        ]

    def get_features(self, obj):
        slug = obj.plan.slug if obj and obj.plan else "free"
        return get_features_for_plan(slug)
