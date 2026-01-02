from rest_framework import generics, permissions
from apps.subscriptions.models import SubscriptionPlan
from apps.subscriptions.serializers import PlanSerializer


class PlanListAPIView(generics.ListAPIView):
    queryset = SubscriptionPlan.objects.filter(is_active=True).order_by("price_cents")
    serializer_class = PlanSerializer
    permission_classes = [permissions.IsAuthenticated]


class PublicPlanListView(generics.ListAPIView):
    """
    Public endpoint: list all active subscription plans.
    No authentication required.
    """
    queryset = SubscriptionPlan.objects.filter(is_active=True).order_by("price_cents")
    serializer_class = PlanSerializer
    permission_classes = [permissions.AllowAny]
