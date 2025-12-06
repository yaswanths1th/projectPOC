# backend/apps/accounts/views_permissions.py
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.shortcuts import get_object_or_404
from .models_permissions import Permission, DepartmentPermission, RolePermission, UserPermissionOverride
from .serializers_permissions import (
    PermissionSerializer,
    RolePermissionSerializer,
    DepartmentPermissionSerializer,
    UserPermissionOverrideSerializer
)
from django.apps import apps

Role = apps.get_model('accounts', 'Role')
Department = apps.get_model('accounts', 'Department')
User = apps.get_model('accounts', 'User')

class PermissionViewSet(viewsets.ModelViewSet):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]  # admin-only management

class RolePermissionViewSet(viewsets.ModelViewSet):
    queryset = RolePermission.objects.all()
    serializer_class = RolePermissionSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        qs = super().get_queryset()
        role_id = self.request.query_params.get('role_id')
        if role_id:
            qs = qs.filter(role_id=role_id)
        return qs

class DepartmentPermissionViewSet(viewsets.ModelViewSet):
    queryset = DepartmentPermission.objects.all()
    serializer_class = DepartmentPermissionSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        qs = super().get_queryset()
        dept_id = self.request.query_params.get('department_id')
        if dept_id:
            qs = qs.filter(department_id=dept_id)
        return qs

class UserPermissionOverrideViewSet(viewsets.ModelViewSet):
    queryset = UserPermissionOverride.objects.all()
    serializer_class = UserPermissionOverrideSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        qs = super().get_queryset()
        user_id = self.request.query_params.get('user_id')
        if user_id:
            qs = qs.filter(user_id=user_id)
        return qs

# helper endpoint to check if the current user has a given codename permission
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def has_permission_view(request):
    """
    Check if logged-in user has a permission.
    """
    codename = request.query_params.get('codename')
    if not codename:
        return Response({"has": False, "reason": "codename_missing"}, status=400)

    user = request.user

    # 1. Find permission object
    try:
        permission = Permission.objects.get(codename=codename)
    except Permission.DoesNotExist:
        return Response({"has": False, "reason": "invalid_permission"}, status=200)

    # 2. USER OVERRIDE (highest priority)
    override = UserPermissionOverride.objects.filter(user=user, permission=permission).first()
    if override:
        return Response({
            "has": override.is_allowed,
            "reason": "user_override_allow" if override.is_allowed else "user_override_deny"
        })

    # 3. ROLE PERMISSIONS
    if user.role_id:
        rp = RolePermission.objects.filter(role_id=user.role_id, permission=permission).first()
        if rp:
            return Response({
                "has": rp.is_allowed,
                "reason": "role_allowed" if rp.is_allowed else "role_denied"
            })

    # 4. DEPARTMENT PERMISSIONS
    if user.department_id:
        dp = DepartmentPermission.objects.filter(
            department_id=user.department_id,
            permission=permission
        ).exists()
        if dp:
            return Response({
                "has": True,
                "reason": "department_allowed"
            })

    # 5. Default: Not allowed
    return Response({"has": False, "reason": "not_allowed"})
