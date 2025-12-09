# backend/apps/subscriptions/urls.py

from django.urls import path
from .views import (
    PlanListAPIView,
    CurrentSubscriptionView,
    SubscribeView,
    ai_free_chat,
)

urlpatterns = [
    # GET  /api/plans/
    path("plans/", PlanListAPIView.as_view(), name="plans-list"),

    # GET  /api/subscription/
    path("subscription/", CurrentSubscriptionView.as_view(), name="current-subscription"),

    # POST /api/subscribe/
    path("subscribe/", SubscribeView.as_view(), name="subscribe"),

    # POST /api/ai/free-chat/
    path("ai/free-chat/", ai_free_chat, name="ai-free-chat"),
]
