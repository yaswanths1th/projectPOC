# backend/apps/subscriptions/permissions.py

from rest_framework.permissions import BasePermission

from .models import SubscriptionPlan, get_features_for_plan


class CanUseAI(BasePermission):
    """
    Example permission for AI Chat views.
    Uses subscription_feature_matrix -> "can_use_ai".
    """

    message = "Your current subscription does not allow AI access."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        # get active plan slug
        from .models import UserSubscription

        sub = (
            UserSubscription.objects
            .select_related("plan")
            .filter(user=user, active=True)
            .order_by("-started_at")
            .first()
        )

        if sub:
            plan_slug = sub.plan.slug
        else:
            plan_slug = "free"

        features = get_features_for_plan(plan_slug)
        return bool(features.get("can_use_ai", False))
