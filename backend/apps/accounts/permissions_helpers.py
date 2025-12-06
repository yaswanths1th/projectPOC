# backend/apps/accounts/permissions_helpers.py
from rest_framework.permissions import BasePermission
from .models_permissions import Permission, UserPermissionOverride, RolePermission, DepartmentPermission

class HasCodenamePermission(BasePermission):
    """
    Usage: set permission_required attribute on view: view.permission_required = 'edit_user'
    Or use in viewset: permission_classes = [IsAuthenticated, HasCodenamePermission]
    and add `permission_required = 'codename'` on the view
    """

    def has_permission(self, request, view):
        codename = getattr(view, 'permission_required', None) or request.query_params.get('codename')
        if not codename:
            return False

        user = request.user
        try:
            perm = Permission.objects.get(codename=codename)
        except Permission.DoesNotExist:
            return False

        # user override
        try:
            uo = UserPermissionOverride.objects.get(user=user, permission=perm)
            return bool(uo.is_allowed)
        except UserPermissionOverride.DoesNotExist:
            pass

        # role explicit
        if getattr(user, 'role', None):
            try:
                rp = RolePermission.objects.get(role=user.role, permission=perm)
                return bool(rp.is_allowed)
            except RolePermission.DoesNotExist:
                pass

        # dept explicit
        if getattr(user, 'department', None):
            try:
                DepartmentPermission.objects.get(department=user.department, permission=perm)
                return True
            except DepartmentPermission.DoesNotExist:
                pass

        return False
