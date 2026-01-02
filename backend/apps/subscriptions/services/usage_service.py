# backend/apps/subscriptions/services/usage_service.py

from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.subscriptions.models import (
    TenantSubscription,
    PlanResourcePolicy,
    SubscriptionResourceLimit,
    TenantUsage,
    TenantMeteredUsage,
)

from apps.accounts.models import User  # ✅ IMPORTANT


def consume_resource(tenant, resource_key: str, delta: int = 1):
    """
    Central SaaS-grade usage enforcement
    - Users → realtime count
    - Others → tenant_usage table
    """

    # 1️⃣ Active subscription
    sub = (
        TenantSubscription.objects
        .select_related("plan")
        .filter(tenant=tenant, active=True)
        .order_by("-started_at")
        .first()
    )

    if not sub:
        raise ValidationError("No active subscription found")

    plan_slug = sub.plan.slug

    # 2️⃣ Resource limit
    try:
        limit_row = SubscriptionResourceLimit.objects.get(
            resource_key=resource_key
        )
        limit = getattr(limit_row, plan_slug)
    except Exception:
        raise ValidationError("Invalid resource limit configuration")

    # 3️⃣ Policy (HARD / SOFT)
    policy = PlanResourcePolicy.objects.filter(
        plan=sub.plan,
        resource_key=resource_key
    ).first()

    limit_type = policy.limit_type if policy else "HARD"
    warning_pct = policy.warning_percentage if policy else 100
    warning_at = int(limit * (warning_pct / 100))

    # ===========================
    # 🔥 USERS = REALTIME COUNT
    # ===========================
    if resource_key == "users":
        current_used = User.objects.filter(
            tenant=tenant,
            is_active=True
        ).count()

        new_value = current_used + delta

        # BELOW WARNING
        if new_value < warning_at:
            return _response(new_value, limit, warning=False)

        # WARNING
        if warning_at <= new_value <= limit:
            return _response(new_value, limit, warning=True)

        # LIMIT HIT
        if new_value > limit:
            raise ValidationError({
                "code": "RESOURCE_LIMIT_REACHED",
                "resource": "users",
                "detail": f"users limit reached ({current_used}/{limit}). Upgrade plan."
            })

    # ===========================
    # 🔁 ALL OTHER RESOURCES
    # ===========================
    with transaction.atomic():
        usage = (
            TenantUsage.objects
            .select_for_update()
            .get(tenant=tenant, resource_key=resource_key)
        )

        new_value = usage.used + delta

        if new_value < warning_at:
            usage.used = new_value
            usage.save(update_fields=["used"])
            return _response(new_value, limit, warning=False)

        if warning_at <= new_value < limit:
            usage.used = new_value
            usage.save(update_fields=["used"])
            return _response(new_value, limit, warning=True)

        if new_value >= limit:
            if limit_type == "HARD":
                raise ValidationError({
                    "code": "RESOURCE_LIMIT_REACHED",
                    "resource": resource_key,
                    "detail": f"{resource_key} limit reached ({usage.used}/{limit}). Upgrade plan."
                })

            # SOFT LIMIT → meter overage
            overage = new_value - limit

            TenantMeteredUsage.objects.create(
                tenant=tenant,
                resource_key=resource_key,
                overage_units=overage,
                period_start=usage.period_start
            )

            usage.used = new_value
            usage.save(update_fields=["used"])

            return _response(new_value, limit, warning=True)


def _response(used, limit, warning):
    return {
        "allowed": True,
        "warning": warning,
        "used": used,
        "limit": limit,
    }
