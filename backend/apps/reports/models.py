from django.db import models
from django.conf import settings

User = settings.AUTH_USER_MODEL


class UsageEvent(models.Model):
    """
    Tracks user actions for reports.
    """

    EVENT_CHOICES = (
        ("login", "Login"),
        ("edit_profile", "Edit Profile"),
        ("change_password", "Change Password"),
        ("use_ai", "Use AI"),
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="usage_events"
    )
    event = models.CharField(max_length=50, choices=EVENT_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "reports_usage_event"
        ordering = ["-created_at"]


class ErrorLog(models.Model):
    """
    Tracks backend/system errors for admin reports.
    """

    error_type = models.CharField(max_length=50)
    message = models.TextField()
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "reports_error_log"
        ordering = ["-created_at"]
