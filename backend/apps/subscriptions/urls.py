# backend/apps/subscriptions/urls.py

from django.urls import path
from .views import PlanListAPIView, CurrentSubscriptionView, SubscribeView

urlpatterns = [
    # GET /api/plans/
    path("plans/", PlanListAPIView.as_view(), name="plan-list"),

    # GET /api/subscription/
    path("subscription/", CurrentSubscriptionView.as_view(), name="current-subscription"),

    # POST /api/subscribe/
    path("subscribe/", SubscribeView.as_view(), name="subscribe"),
]
