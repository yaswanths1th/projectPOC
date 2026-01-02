from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework.routers import DefaultRouter

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
    create_invite,
    validate_invite,
    accept_invite,
    check_username,
    check_email,
    superadmin_stats,
    
)

# ⭐ Correct import
from .views_tenant import TenantViewSet
from .views_tenant_admin import TenantAdminViewSet

from .views_constants import ConstantsAPIView, SingleMessageAPIView

# Router for tenants
router = DefaultRouter()
router.register(r"tenants", TenantViewSet, basename="tenants")
router.register("tenant-admins", TenantAdminViewSet, basename="tenant-admins")

urlpatterns = [
    # Auth
    path("login/", CustomTokenObtainPairView.as_view()),
    path("register/", register_user),
    path("token/refresh/", TokenRefreshView.as_view()),

    # Profile
    path("profile/", ProfileAPIView.as_view()),

    # Users
    path("admin/users/", AdminUserListCreateAPIView.as_view()),
    path("admin/users/<int:pk>/", AdminUserUpdateDeleteAPIView.as_view()),
    path("admin/users/<int:pk>/toggle/", user_toggle_active),
    path("admin/stats/", AdminUserStatsAPIView.as_view()),

    # Departments
    path("departments/", DepartmentListCreateAPIView.as_view()),
    path("departments/<int:pk>/", DepartmentRetrieveUpdateDestroyAPIView.as_view()),
    path("departments/<int:pk>/toggle/", department_toggle_active),

    # Roles
    path("roles/", RoleListCreateAPIView.as_view()),
    path("roles/<int:pk>/", RoleRetrieveUpdateDestroyAPIView.as_view()),
    path("roles/<int:pk>/toggle/", role_toggle_active),

    # Messages
    path("messages/", get_messages),

    # Debug constants
    path("constants/", ConstantsAPIView.as_view()),
    path("messages/<str:type>/<str:code>/", SingleMessageAPIView.as_view()),

    # Email
    path("send-user-credentials/", send_user_credentials),

    # Availability checks
    path("check-username/", check_username),
    path("check-email/", check_email),

    # Extra profile
    path("profile/", ProfileAPIView.as_view(), name="profile"),


    # Invites
    path("invites/", create_invite),
    path("invites/validate/<str:code>/", validate_invite),
    path("invites/accept/", accept_invite),

    # Superadmin stats
    path("superadmin/stats/", superadmin_stats),
]

# ⭐ REQUIRED
urlpatterns += router.urls
