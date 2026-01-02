from rest_framework.permissions import BasePermission,IsAuthenticated
from .utils.permissions import get_effective_permissions

class IsRoleAdmin(BasePermission):
    """
    Allows:
    - superadmin
    - tenant admin
    - department admins (via permissions)
    """

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        # Superadmin always allowed
        if user.is_superadmin:
            return True

        # Tenant admin allowed
        if user.is_tenant_admin:
            return True

        # Department admin → must have admin permission
        return "view_manage_user" in get_effective_permissions(user)


class IsSuperAdmin(IsAuthenticated):
    """
    Allows access only to superadmin users.
    """
    def has_permission(self, request, view):
        # First check JWT auth
        if not super().has_permission(request, view):
            return False
        return bool(request.user and request.user.is_superadmin)
