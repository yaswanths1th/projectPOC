from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from apps.accounts.models import Tenant, User
from apps.subscriptions.models import (
    TenantSubscription,
    TenantUsage,
    SubscriptionResourceLimit,
)
from apps.accounts.permissions import IsSuperAdmin


# ============================
# SuperAdmin → Tenant List
# ============================
class SuperAdminTenantListView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        tenants = Tenant.objects.all().order_by("name")

        data = [
            {
                "id": t.id,
                "name": t.name,
                "slug": t.slug,
                "is_active": t.is_active,
                "created_at": t.created_at,
            }
            for t in tenants
        ]

        return Response(data, status=status.HTTP_200_OK)


# ============================
# SuperAdmin → Tenant Report
# ============================
class SuperAdminTenantReportView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request, tenant_id):
        # --- Tenant ---
        try:
            tenant = Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            return Response(
                {"detail": "Tenant not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # --- Subscription ---
        sub = (
            TenantSubscription.objects
            .select_related("plan")
            .filter(tenant=tenant, active=True)
            .order_by("-started_at")
            .first()
        )

        plan_slug = sub.plan.slug if sub and sub.plan else "free"
        plan_name = sub.plan.name if sub and sub.plan else "Free"

        # --- Users ---
        users_qs = User.objects.filter(tenant=tenant)
        total_users = users_qs.count()
        active_users = users_qs.filter(is_active=True).count()

        # --- Resource Limits ---
        limits = SubscriptionResourceLimit.objects.all()
        limit_map = {
            l.resource_key: getattr(l, plan_slug, None)
            for l in limits
        }

        # --- Usage ---
        usage_rows = TenantUsage.objects.filter(tenant=tenant)

        usage_data = []
        for row in usage_rows:
            limit = limit_map.get(row.resource_key)
            used = row.used

            status_label = "OK"
            if limit is not None:
                if used > limit:
                    status_label = "LIMIT_EXCEEDED"
                elif used == limit:
                    status_label = "LIMIT_REACHED"

            usage_data.append({
                "resource": row.resource_key,
                "used": used,
                "limit": limit,
                "status": status_label,
                "last_updated_at": row.last_updated_at,
            })

        # --- Final Payload ---
        return Response({
            "tenant": {
                "id": tenant.id,
                "name": tenant.name,
                "slug": tenant.slug,
                "is_active": tenant.is_active,
            },
            "subscription": {
                "plan": plan_name,
                "plan_slug": plan_slug,
                "status": sub.status if sub else "inactive",
                "started_at": sub.started_at if sub else None,
            },
            "users": {
                "total": total_users,
                "active": active_users,
                "inactive": total_users - active_users,
            },
            "usage": usage_data,
        }, status=status.HTTP_200_OK)
