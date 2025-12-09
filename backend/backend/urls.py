# backend/backend/urls.py
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView
from apps.subscriptions import views as subscription_views

urlpatterns = [
    # Admin
    path("dj-admin/", admin.site.urls),

    # Auth & Account routes
    path("api/auth/", include("apps.accounts.urls")),

    # JWT helpers
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/token/verify/", TokenVerifyView.as_view(), name="token_verify"),

    # Addresses
    path("api/addresses/", include("apps.addresses.urls")),

    # Password reset / change
    path("api/password-reset/", include("apps.password_reset.urls")),
    path("api/change-password/", include("apps.change_password.urls")),

    # View profile / admin user management
    path("api/viewprofile/", include("apps.viewprofile.urls")),
    path("api/permissions/", include("apps.accounts.urls_permissions")),
    path("api/", include("apps.subscriptions.urls")),

]
