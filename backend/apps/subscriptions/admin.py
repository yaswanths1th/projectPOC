from django.contrib import admin
from .models import Plan, UserSubscription

@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'price_cents', 'interval', 'is_active', 'can_use_ai')
    search_fields = ('name', 'slug')

@admin.register(UserSubscription)
class UserSubscriptionAdmin(admin.ModelAdmin):
    list_display = ('user', 'plan', 'active', 'started_at', 'expires_at', 'payment_provider')
    list_filter = ('active', 'plan', 'payment_provider')
    search_fields = ('user__email', 'user__username', 'payment_reference')
