# backend/apps/subscriptions/views.py

from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db import transaction

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status

from .models import SubscriptionPlan, UserSubscription, get_features_for_plan
from .serializers import SubscriptionPlanSerializer, UserSubscriptionSerializer
from rest_framework import generics, permissions


class PlanListAPIView(generics.ListAPIView):
    """
    GET /api/plans/
    Returns all active plans with feature flags.
    """
    queryset = SubscriptionPlan.objects.filter(is_active=True).order_by("price_cents")
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [permissions.AllowAny]


class CurrentSubscriptionView(APIView):
    """
    GET /api/subscription/
    Returns the user's active subscription or a "free" fallback object.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        sub = (
            UserSubscription.objects
            .select_related("plan")
            .filter(user=user, active=True)
            .order_by("-started_at")
            .first()
        )

        if sub:
            serializer = UserSubscriptionSerializer(sub)
            return Response(serializer.data, status=status.HTTP_200_OK)

        # No active row → fallback to free
        free_plan = SubscriptionPlan.objects.filter(slug="free", is_active=True).first()
        features = get_features_for_plan("free")

        if free_plan:
            data = {
                "id": None,
                "plan": SubscriptionPlanSerializer(free_plan).data,
                "started_at": None,
                "expires_at": None,
                "active": True,
                "status": "free",
                "payment_provider": None,
                "payment_reference": None,
                "can_use_ai": bool(features.get("can_use_ai", False)),
                "can_edit_profile": bool(features.get("can_edit_profile", True)),
                "can_change_password": bool(features.get("can_change_password", True)),
                "max_projects": features.get("max_projects"),
            }
            return Response(data, status=status.HTTP_200_OK)

        # No free plan in DB → ultimate hard-coded fallback
        data = {
            "id": None,
            "plan": {
                "id": None,
                "slug": "free",
                "name": "Free",
                "description": "Free fallback plan",
                "price_cents": 0,
                "currency": "INR",
                "billing_cycle": "monthly",
                "interval": "monthly",
                "is_active": True,
            },
            "started_at": None,
            "expires_at": None,
            "active": True,
            "status": "free",
            "payment_provider": None,
            "payment_reference": None,
            "can_use_ai": False,
            "can_edit_profile": True,
            "can_change_password": True,
            "max_projects": 1,
        }
        return Response(data, status=status.HTTP_200_OK)


class SubscribeView(APIView):
    """
    POST /api/subscribe/
    Body: { "plan_slug": "pro" }

    Uses ORM only (no raw SQL) to:
    1. Mark existing subscriptions for this user as expired
    2. Create a new active subscription
    3. Return the new subscription as JSON
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        plan_slug = request.data.get("plan_slug")

        if not plan_slug:
            return Response(
                {"detail": "plan_slug is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        plan = get_object_or_404(
            SubscriptionPlan,
            slug=plan_slug,
            is_active=True,
        )

        now = timezone.now()

        with transaction.atomic():
            # 1) expire existing active subs
            UserSubscription.objects.filter(user=user, active=True).update(
                active=False,
                status="expired",
                expires_at=now,
            )

            # 2) create new active subscription
            new_sub = UserSubscription.objects.create(
                user=user,
                plan=plan,
                started_at=now,
                status="active",
                active=True,
                payment_provider=request.data.get("payment_provider"),
                payment_reference=request.data.get("payment_reference"),
            )

        # For debugging in runserver console
        print(
            f"[SubscribeView ORM] user={user.id}, plan={plan.slug}, new_id={new_sub.id}, active={new_sub.active}"
        )

        serializer = UserSubscriptionSerializer(new_sub)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
