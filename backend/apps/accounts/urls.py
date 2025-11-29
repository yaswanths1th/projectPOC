from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from . import views
from .views import (
    register_user,
    ProfileAPIView,
    CustomTokenObtainPairView,
    AdminUserListCreateAPIView,
    AdminUserUpdateDeleteAPIView,
    AdminUserStatsAPIView,
    user_toggle_active,
    DepartmentListCreateAPIView,
    DepartmentRetrieveUpdateDestroyAPIView,
    department_toggle_active,
    RoleListCreateAPIView,
    RoleRetrieveUpdateDestroyAPIView,
    role_toggle_active,
    send_user_credentials,
    get_messages,
    login_init,              # 🔐 Direct login (no OTP)
    logout_view,             # 🔐 Logout (clear cookies)
    refresh_token_view,      # 🔐 Refresh token from cookie
)
from .views_constants import ConstantsAPIView, SingleMessageAPIView


urlpatterns = [
    # ================================================================
    # 🔐 DIRECT LOGIN (NO OTP)
    # ================================================================
    path("login-init/", login_init),


    # ================================================================
    # 🔐 LOGOUT (Clear cookies)
    # ================================================================
    path("logout/", logout_view),


    # ================================================================
    # 🔐 TOKEN REFRESH (from cookie → new cookie)
    # ================================================================
    path("token/refresh/", refresh_token_view),


    # ================================================================
    # 🔓 OPTIONAL OLD LOGIN (JWT DIRECT LOGIN)
    # ================================================================
    path("login/", CustomTokenObtainPairView.as_view()),


    # ================================================================
    # 📝 REGISTRATION
    # ================================================================
    path("register/", register_user),


    # ================================================================
    # 👤 PROFILE
    # ================================================================
    path("profile/", ProfileAPIView.as_view()),


    # ================================================================
    # 👑 ADMIN — USERS
    # ================================================================
    path("admin/users/", AdminUserListCreateAPIView.as_view()),
    path("admin/users/<int:pk>/", AdminUserUpdateDeleteAPIView.as_view()),
    path("admin/users/<int:pk>/toggle/", user_toggle_active),
    path("admin/stats/", AdminUserStatsAPIView.as_view()),


    # ================================================================
    # 🏢 DEPARTMENTS
    # ================================================================
    path("departments/", DepartmentListCreateAPIView.as_view()),
    path("departments/<int:pk>/", DepartmentRetrieveUpdateDestroyAPIView.as_view()),
    path("departments/<int:pk>/toggle/", department_toggle_active),


    # ================================================================
    # 🧩 ROLES
    # ================================================================
    path("roles/", RoleListCreateAPIView.as_view()),
    path("roles/<int:pk>/", RoleRetrieveUpdateDestroyAPIView.as_view()),
    path("roles/<int:pk>/toggle/", role_toggle_active),


    # ================================================================
    # 💬 MESSAGES
    # ================================================================
    path("messages/", get_messages, name="messages"),
    path("messages/<str:type>/<str:code>/", SingleMessageAPIView.as_view()),


    # ================================================================
    # 📧 CREDENTIALS
    # ================================================================
    path("send-user-credentials/", send_user_credentials),
    path("check-username/", views.check_username),
    path("check-email/", views.check_email),


    # ================================================================
    # 🔐 PERMISSIONS API
    # ================================================================
    path("permissions/", include("apps.accounts.urls_permissions")),
]
