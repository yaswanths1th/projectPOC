# backend/apps/accounts/permissions.py
from rest_framework.permissions import BasePermission

class IsRoleAdmin(BasePermission):
    """
    Admin if:
     - user.is_staff or user.is_superuser OR
     - user.role exists, user.role.is_active and role_id != 2
    """
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False
        if user.is_staff or user.is_superuser:
            return True
        role = getattr(user, "role", None)
        if not role:
            return False
        return bool(getattr(user, "role_id", None) is not None and user.role_id != 2 and getattr(role, "is_active", True))
