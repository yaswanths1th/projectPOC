# backend/apps/subscriptions/models.py

from django.conf import settings
from django.db import models
from django.utils import timezone

# If you have a custom User model in apps.accounts.models.User,
# settings.AUTH_USER_MODEL will point to it.
User = settings.AUTH_USER_MODEL


class SubscriptionPlan(models.Model):
    """
    Base plans: free, basic, pro, enterprise.

    This matches the table you saw earlier in Postgres:

    Table "public.subscription_plan"
      id            | bigint | PK
      slug          | varchar(50) | unique
      name          | varchar(100)
      price_cents   | integer
      created_at    | timestamptz
      currency      | varchar(10)
      billing_cycle | varchar(20)
      updated_at    | timestamptz
      interval      | varchar(20)
      is_active     | boolean
      description   | text
    """

    slug = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)

    price_cents = models.IntegerField(default=0)
    currency = models.CharField(max_length=10, default="INR")
    billing_cycle = models.CharField(max_length=20, default="monthly")
    interval = models.CharField(max_length=20, default="monthly")

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "subscription_plan"
        ordering = ["price_cents"]

    def __str__(self):
        return f"{self.name} ({self.slug})"


class UserSubscription(models.Model):
    """
    Concrete subscription rows.

    We explicitly set db_table so it matches your earlier raw SQL name:
    subscriptions_usersubscription
    """

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="subscriptions",
    )
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.PROTECT,
        related_name="user_subscriptions",
    )

    started_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(null=True, blank=True)

    active = models.BooleanField(default=True)
    status = models.CharField(max_length=20, default="active")

    payment_provider = models.CharField(max_length=50, null=True, blank=True)
    payment_reference = models.CharField(max_length=100, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "subscriptions_usersubscription"
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.user} → {self.plan.slug} ({self.status})"


# -----------------------------
# Tenant Subscription (NEW)
# -----------------------------
class TenantSubscription(models.Model):
    tenant = models.ForeignKey(
        "accounts.Tenant",
        on_delete=models.CASCADE,
        related_name="subscriptions",
    )
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.PROTECT,
        related_name="tenant_subscriptions",
    )

    started_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(null=True, blank=True)

    active = models.BooleanField(default=True)
    status = models.CharField(max_length=20, default="active")

    payment_provider = models.CharField(max_length=50, null=True, blank=True)
    payment_reference = models.CharField(max_length=100, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "subscriptions_tenantsubscription"
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.tenant} → {self.plan.slug} ({self.status})"


# -----------------------------
#  Feature Matrix (unchanged)
# -----------------------------
class SubscriptionFeatureMatrix(models.Model):
    slug = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=255)

    free = models.CharField(max_length=50, null=True, blank=True)
    basic = models.CharField(max_length=50, null=True, blank=True)
    pro = models.CharField(max_length=50, null=True, blank=True)
    enterprise = models.CharField(max_length=50, null=True, blank=True)

    data_type = models.CharField(max_length=20, default="boolean")

    class Meta:
        db_table = "subscription_feature_matrix"
        managed = False

    def __str__(self):
        return self.slug


# -----------------------------
# Helpers
# -----------------------------
def _parse_value(raw: str | None, data_type: str):
    if raw is None:
        return None
    if data_type == "boolean":
        return str(raw).lower() in ("true", "1", "yes", "y")
    if data_type == "integer":
        try: return int(raw)
        except: return None
    return raw


def get_features_for_plan(plan_slug: str) -> dict:
    """
    Read feature flags from subscription_feature_matrix for a given plan.
    plan_slug: 'free', 'basic', 'pro', 'enterprise'
    Returns e.g.:
    {
      "can_edit_profile": True,
      "can_change_password": True,
      "can_use_ai": False,
      "max_projects": 5,
      ...
    }
    """
    plan_slug = (plan_slug or "free").lower()
    if plan_slug not in ("free", "basic", "pro", "enterprise"):
        plan_slug = "free"

    features = {}
    for row in SubscriptionFeatureMatrix.objects.all():
        raw = getattr(row, plan_slug, None)
        val = _parse_value(raw, row.data_type.lower())
        features[row.slug] = val
    return features


def get_features_for_tenant(tenant):
    """
    SAFE lazy imports — prevents AppRegistryNotReady error
    """
    from django.apps import apps
    TenantSubscription = apps.get_model("subscriptions", "TenantSubscription")

    if not tenant:
        return get_features_for_plan("free")

    sub = (
        TenantSubscription.objects.select_related("plan")
        .filter(tenant=tenant, active=True)
        .order_by("-started_at")
        .first()
    )

    if sub and sub.plan:
        return get_features_for_plan(sub.plan.slug)

    return get_features_for_plan("free")

# -----------------------------
# Tenant Usage (EXISTING TABLE)
# -----------------------------
class TenantUsage(models.Model):
    tenant = models.ForeignKey(
        "accounts.Tenant",
        on_delete=models.CASCADE,
        related_name="usage_rows"
    )
    resource_key = models.CharField(max_length=50)
    used = models.BigIntegerField()
    period_start = models.DateTimeField()
    period_end = models.DateTimeField(null=True, blank=True)
    last_updated_at = models.DateTimeField()

    class Meta:
        db_table = "tenant_usage"
        managed = False
        unique_together = ("tenant", "resource_key")

    def __str__(self):
        return f"{self.tenant_id} - {self.resource_key}: {self.used}"

# -----------------------------
# Tenant Metered Usage
# -----------------------------
class TenantMeteredUsage(models.Model):
    tenant = models.ForeignKey(
        "accounts.Tenant",
        on_delete=models.CASCADE
    )
    resource_key = models.CharField(max_length=50)
    overage_units = models.BigIntegerField()
    period_start = models.DateTimeField()
    created_at = models.DateTimeField()

    class Meta:
        db_table = "tenant_metered_usage"
        managed = False


# -----------------------------
# Plan Resource Policy
# -----------------------------
class PlanResourcePolicy(models.Model):
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.CASCADE,
        related_name="resource_policies"
    )
    resource_key = models.CharField(max_length=50)
    limit_type = models.CharField(max_length=10)  # HARD / SOFT
    warning_percentage = models.IntegerField(default=80)
    overage_cost_per_unit = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )

    class Meta:
        db_table = "plan_resource_policy"
        managed = False
        unique_together = ("plan", "resource_key")

class SubscriptionResourceLimit(models.Model):
    RESOURCE_CHOICES = [
        ("users", "Users"),
        ("storage_gb", "Storage (GB)"),
        ("api_calls", "API Calls"),
        ("ai_tokens", "AI Tokens"),
    ]

    resource_key = models.CharField(
        max_length=50,
        choices=RESOURCE_CHOICES,
        unique=True
    )

    free = models.IntegerField()
    basic = models.IntegerField()
    pro = models.IntegerField()
    enterprise = models.IntegerField()

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "subscription_resource_limit"

    def __str__(self):
        return self.resource_key
