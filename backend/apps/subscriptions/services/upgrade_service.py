from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.subscriptions.models import (
    SubscriptionPlan,
    TenantSubscription,
)


@transaction.atomic
def upgrade_tenant_plan(tenant, new_plan_slug: str):
    """
    Atomically upgrade tenant subscription
    """

    # 1️⃣ Fetch new plan
    try:
        new_plan = SubscriptionPlan.objects.get(
            slug=new_plan_slug,
            is_active=True
        )
    except SubscriptionPlan.DoesNotExist:
        raise ValidationError("Invalid subscription plan")

    # 2️⃣ Deactivate current subscription
    TenantSubscription.objects.filter(
        tenant=tenant,
        active=True
    ).update(
        active=False,
        status="UPGRADED",
        expires_at=timezone.now()
    )

    # 3️⃣ Create new subscription
    new_sub = TenantSubscription.objects.create(
        tenant=tenant,
        plan=new_plan,
        started_at=timezone.now(),
        active=True,
        status="ACTIVE"
    )

    return {
        "plan": new_plan.slug,
        "price_cents": new_plan.price_cents,
        "started_at": new_sub.started_at,
    }
