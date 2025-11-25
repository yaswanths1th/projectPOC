# backend/apps/accounts/urls_permissions.py
from rest_framework.routers import DefaultRouter
from django.urls import path, include
from .views_permissions import (
    PermissionViewSet,
    RolePermissionViewSet,
    DepartmentPermissionViewSet,
    UserPermissionOverrideViewSet,
    has_permission_view
)

router = DefaultRouter()
router.register('permissions', PermissionViewSet, basename='permissions')
router.register('role-permissions', RolePermissionViewSet, basename='role-permissions')
router.register('department-permissions', DepartmentPermissionViewSet, basename='department-permissions')
router.register('user-permissions', UserPermissionOverrideViewSet, basename='user-permissions')

urlpatterns = [
    path('', include(router.urls)),
    path('has_permission/', has_permission_view, name='has-permission'),
]
