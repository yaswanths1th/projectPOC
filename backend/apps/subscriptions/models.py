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
    status = models.CharField(max_length=20, default="active")  # active, expired, cancelled

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
#  Simple feature matrix helper
# -----------------------------

class SubscriptionFeatureMatrix(models.Model):
    """
    id | slug | name | free | basic | pro | enterprise | data_type
    Example row:
    1  | can_edit_profile | Edit Profile | false | true | true | true | boolean
    """

    slug = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=255)

    free = models.CharField(max_length=50, null=True, blank=True)
    basic = models.CharField(max_length=50, null=True, blank=True)
    pro = models.CharField(max_length=50, null=True, blank=True)
    enterprise = models.CharField(max_length=50, null=True, blank=True)

    data_type = models.CharField(max_length=20, default="boolean")

    class Meta:
        db_table = "subscription_feature_matrix"
        managed = False    # ✅ very important: DO NOT let Django create/alter this table

    def __str__(self):
        return self.slug
    


# -----------------------------
#  Feature matrix helper (DB based)
# -----------------------------

def _parse_value(raw: str | None, data_type: str):
    """
    Convert the raw string from DB to correct Python type.
    data_type is 'boolean' or 'integer'.
    """
    if raw is None:
        return None

    if data_type == "boolean":
        if isinstance(raw, bool):
            return raw
        s = str(raw).strip().lower()
        return s in ("true", "1", "yes", "y", "t")
    elif data_type == "integer":
        try:
            return int(raw)
        except (TypeError, ValueError):
            return None
    # default: return as-is
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
        raw_value = getattr(row, plan_slug, None)
        value = _parse_value(raw_value, (row.data_type or "").lower())
        features[row.slug] = value

    return features
