from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db import transaction

from apps.subscriptions.models import SubscriptionPlan, UserSubscription
from apps.subscriptions.services.upgrade_service import upgrade_tenant_plan


class SubscribeView(APIView):
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
            UserSubscription.objects.filter(
                user=user, active=True
            ).update(
                active=False,
                status="expired",
                expires_at=now,
            )

            sub = UserSubscription.objects.create(
                user=user,
                plan=plan,
                started_at=now,
                active=True,
                status="active",
            )

        return Response(
            {"detail": "Subscribed successfully", "plan": plan.slug},
            status=status.HTTP_201_CREATED,
        )


class UpgradePlanView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        tenant = request.user.tenant
        plan_slug = request.data.get("plan_slug")

        if not tenant:
            return Response(
                {"detail": "Tenant not found for user"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not plan_slug:
            return Response(
                {"detail": "plan_slug required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        result = upgrade_tenant_plan(tenant, plan_slug)

        return Response(
            {
                "message": "Plan upgraded successfully",
                "subscription": result,
            },
            status=status.HTTP_200_OK
        )
