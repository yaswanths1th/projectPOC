# backend/apps/subscriptions/admin.py
from django.contrib import admin
from django.apps import apps
from django.utils.translation import gettext_lazy as _
from . import models

Plan = None
UserSubscription = None
try:
    Plan = apps.get_model("subscriptions", "Plan")
except LookupError:
    Plan = getattr(models, "Plan", None)

try:
    UserSubscription = apps.get_model("subscriptions", "UserSubscription")
except LookupError:
    UserSubscription = getattr(models, "UserSubscription", None)

def _safe_fields_for_model(model, desired):
    if model is None:
        return tuple()
    try:
        model_field_names = {f.name for f in model._meta.get_fields()}
    except Exception:
        try:
            model_field_names = {f.name for f in model._meta.fields}
        except Exception:
            model_field_names = set()
    safe = [f for f in desired if f in model_field_names]
    return tuple(safe)

if Plan is not None:
    PLAN_DESIRED = ("id", "slug", "name", "price_cents", "is_active", "interval")
    PLAN_LIST_DISPLAY = _safe_fields_for_model(Plan, PLAN_DESIRED) or ("id", "slug", "name")
else:
    PLAN_LIST_DISPLAY = ("id", "slug", "name")

@admin.register(Plan) if Plan is not None else lambda cls: cls
class PlanAdmin(admin.ModelAdmin):
    list_display = PLAN_LIST_DISPLAY
    search_fields = ("slug", "name")
    readonly_fields = ("id",)

if UserSubscription is not None:
    SUBS_DESIRED = ("id", "user", "plan", "status", "is_active", "created_at", "start_date", "end_date")
    SUBS_LIST_DISPLAY = _safe_fields_for_model(UserSubscription, SUBS_DESIRED) or ("id", "user", "plan")
    @admin.register(UserSubscription)
    class UserSubscriptionAdmin(admin.ModelAdmin):
        list_display = SUBS_LIST_DISPLAY
        search_fields = ("user__username", "plan__slug")
        readonly_fields = ("id",)
