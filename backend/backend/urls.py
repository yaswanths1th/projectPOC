# backend/backend/urls.py
from django.contrib import admin
from django.urls import path, include

# Import custom auth views from accounts
from apps.accounts.views import (
    CustomTokenObtainPairView,
    refresh_token_view,
    logout_view,
    send_user_credentials,
    verify_otp_and_set_password,
)

urlpatterns = [
    # Django admin
    path("dj-admin/", admin.site.urls),

    # ============================
    # 🔐 AUTH (Cookie-based JWT)
    # ============================
    # Login → sets HttpOnly cookies
    path("api/auth/login/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),

    # Refresh Token (reads refresh cookie)
    path("api/auth/token/refresh/", refresh_token_view, name="token_refresh"),

    # Logout → clears cookies
    path("api/auth/logout/", logout_view, name="logout"),

    # ============================
    # 🔐 OTP Password Setup
    # ============================
    # Admin → sends OTP to user
    path("api/auth/send-credentials/", send_user_credentials, name="send_user_credentials"),

    # User → verifies OTP + sets password
    path("api/auth/verify-otp/", verify_otp_and_set_password, name="verify_otp_and_set_password"),

    # ============================
    # 📦 Existing account routes
    # ============================
    path("api/auth/", include("apps.accounts.urls")),

    # ============================
    # 📍 Addresses
    # ============================
    path("api/addresses/", include("apps.addresses.urls")),

    # ============================
    # 🔐 Password Reset & Change
    # ============================
    path("api/password-reset/", include("apps.password_reset.urls")),
    path("api/change-password/", include("apps.change_password.urls")),

    # ============================
    # 👤 User Profile
    # ============================
    path("api/viewprofile/", include("apps.viewprofile.urls")),

    # ============================
    # 🔒 Permissions Management
    # ============================
    path("api/permissions/", include("apps.accounts.urls_permissions")),
]
