from django.urls import path
from apps.subscriptions.views import (
    PlanListAPIView,
    CurrentSubscriptionView,
    SubscribeView,
    UpgradePlanView,
    ai_free_chat,
    AdminUsageSummaryView,
    SuperAdminTenantListView,
    SuperAdminTenantReportView,
)

urlpatterns = [
    # plans
    path("plans/", PlanListAPIView.as_view()),

    # subscription
    path("subscription/current/", CurrentSubscriptionView.as_view()),
    path("subscription/upgrade/", UpgradePlanView.as_view()),
    path("subscribe/", SubscribeView.as_view()),

    # ai
    path("ai/free-chat/", ai_free_chat),

    # admin
    path("admin/usage-summary/", AdminUsageSummaryView.as_view()),

    # superadmin
    path("superadmin/tenants/", SuperAdminTenantListView.as_view()),
    path(
        "superadmin/tenants/<int:tenant_id>/report/",
        SuperAdminTenantReportView.as_view(),
    ),
]
