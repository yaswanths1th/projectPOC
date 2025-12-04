from django.conf import settings
from django.db import models
from django.utils import timezone
from datetime import timedelta

class Plan(models.Model):
    SLUG_MAX = 64

    slug = models.SlugField(max_length=SLUG_MAX, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    price_cents = models.PositiveIntegerField(default=0)  # price in paise/cent (100 = ₹1)
    interval = models.CharField(max_length=16, default='monthly')  # e.g. monthly/yearly
    can_use_ai = models.BooleanField(default=False)
    can_edit_profile = models.BooleanField(default=True)
    can_change_password = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['price_cents', 'name']

    def __str__(self):
        return f"{self.name} ({self.slug})"

class UserSubscription(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='subscriptions')
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT)
    started_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(null=True, blank=True)
    active = models.BooleanField(default=True)
    # payment reference from gateway
    payment_provider = models.CharField(max_length=50, blank=True, null=True)
    payment_reference = models.CharField(max_length=128, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['user', 'active']),
        ]

    def __str__(self):
        return f"{self.user} -> {self.plan.slug} ({'active' if self.active else 'inactive'})"

    def set_expiry_for_interval(self):
        """Set expires_at based on plan.interval. Customize as needed."""
        if self.plan.interval == 'monthly':
            self.expires_at = timezone.now() + timedelta(days=30)
        elif self.plan.interval == 'yearly':
            self.expires_at = timezone.now() + timedelta(days=365)
        else:
            self.expires_at = None
        return self.expires_at
