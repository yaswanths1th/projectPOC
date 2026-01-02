# backend/apps/subscriptions/views/admin.py

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.subscriptions.models import (
    TenantSubscription,
    SubscriptionResourceLimit,
    PlanResourcePolicy,
)
from apps.accounts.models import User


class AdminUsageSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tenant = request.user.tenant

        sub = (
            TenantSubscription.objects
            .select_related("plan")
            .filter(tenant=tenant, active=True)
            .first()
        )

        if sub:
            plan_slug = sub.plan.slug
            plan_name = sub.plan.name
        else:
            # ✅ Default FREE plan when no subscription exists
            plan_slug = "free"
            plan_name = "Free"

        resources = []

        limits = SubscriptionResourceLimit.objects.all()

        for limit in limits:
            resource_key = limit.resource_key
            plan_limit = getattr(limit, plan_slug, None)

            # 🔥 USERS = REAL TIME COUNT
            if resource_key == "users":
                used = User.objects.filter(
                    tenant=tenant,
                    is_active=True
                ).count()
            else:
                used = 0  # default if not implemented yet

            status = "OK"
            if plan_limit is not None and used > plan_limit:
                status = "LIMIT_EXCEEDED"

            resources.append({
                "key": resource_key,
                "used": used,
                "limit": plan_limit,
                "status": status,
            })
        return Response({
            "plan": {
                "slug": plan_slug,
                "name": plan_name,
            },
            "resources": resources,
        })

