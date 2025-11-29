from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView, TokenVerifyView

urlpatterns = [
    path("dj-admin/", admin.site.urls),

    path("api/auth/", include("apps.accounts.urls")),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/token/verify/", TokenVerifyView.as_view(), name="token_verify"),

    path("api/addresses/", include("apps.addresses.urls")),
    path("api/password-reset/", include("apps.password_reset.urls")),
    path("api/change-password/", include("apps.change_password.urls")),
    path("api/viewprofile/", include("apps.viewprofile.urls")),
    path("api/permissions/", include("apps.accounts.urls_permissions")),
]
