# backend/apps/subscriptions/urls.py
from django.urls import path
from . import views

urlpatterns = [
    # Public plans listing (GET)
    path("plans/", views.plans_list, name="plans-list"),

    # Current user's subscription (legacy helper - GET)
    path("subscription/", views.user_subscription, name="current-subscription"),

    # Subscribe (create/update) - POST (class-based view)
    path("subscribe/", views.SubscribeView.as_view(), name="subscribe"),

    # Canonical subscription detail endpoint (GET) - returns active subscription or 204
    path("", views.SubscriptionDetailView.as_view(), name="subscription-detail"),

    # Profile view (returns serialized user profile including subscription info) - GET
    path("profile/", views.profile_view, name="profile"),

    # Alternate route that some frontends expect - GET
    path("api/subscription/", views.user_subscription, name="api-user-subscription"),

    # AI proxy endpoints (preserve multiple possible paths for client compatibility)
    path("ai/free-chat/", views.ai_free_chat, name="ai-free-chat"),
    path("api/ai/free-chat/", views.ai_free_chat, name="api-ai-free-chat"),
    path("subscription/ai/free-chat/", views.ai_free_chat, name="subscription-ai-free-chat"),
    path("accounts/ai/free-chat/", views.ai_free_chat, name="accounts-ai-free-chat"),
]
