# backend/apps/subscriptions/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Plan, UserSubscription

User = get_user_model()

class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = [
            'id', 'slug', 'name', 'description', 'price_cents',
            'interval', 'can_use_ai', 'can_edit_profile', 'can_change_password', 'is_active'
        ]


class UserSubscriptionSerializer(serializers.ModelSerializer):
    plan = PlanSerializer(read_only=True)

    class Meta:
        model = UserSubscription
        fields = [
            'id', 'plan', 'started_at', 'expires_at', 'active',
            'payment_provider', 'payment_reference', 'created_at'
        ]
        read_only_fields = ['id', 'started_at', 'expires_at', 'active', 'payment_provider', 'payment_reference', 'created_at']


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for authenticated user profile with subscription flags
    """
    subscription = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ('id', 'username', 'first_name', 'last_name', 'email', 'is_staff', 'is_active', 'date_joined', 'subscription')

    def get_subscription(self, obj):
        sub = obj.subscriptions.filter(active=True).order_by('-start_date', '-created_at').first()
        if not sub:
            return None
        plan = sub.plan
        return {
            'id': sub.id,
            'slug': plan.slug,
            'name': plan.name,
            'is_active': bool(sub.active),
            'started_at': sub.start_date.isoformat() if sub.start_date else None,
            'expires_at': sub.end_date.isoformat() if getattr(sub, 'end_date', None) else (sub.expires_at.isoformat() if sub.expires_at else None),
            'can_edit_profile': bool(getattr(plan, 'can_edit_profile', False)),
            'can_change_password': bool(getattr(plan, 'can_change_password', False)),
            'can_use_ai': bool(getattr(plan, 'can_use_ai', False)),
            'price_cents': getattr(plan, 'price_cents', None)
        }
