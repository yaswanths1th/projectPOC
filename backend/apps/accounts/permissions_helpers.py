from rest_framework.permissions import BasePermission
from .models_permissions import (
    Permission, 
    UserPermissionOverride, 
    RolePermission, 
    DepartmentPermission
)

class HasCodenamePermission(BasePermission):
    def has_permission(self, request, view):
        codename = getattr(view, 'permission_required', None) or request.query_params.get('codename')
        if not codename:
            return False

        user = request.user
        try:
            perm = Permission.objects.get(codename=codename)
        except Permission.DoesNotExist:
            return False

        # User override
        try:
            uo = UserPermissionOverride.objects.get(user=user, permission=perm)
            return bool(uo.is_allowed)
        except UserPermissionOverride.DoesNotExist:
            pass

        # Role explicit
        if getattr(user, 'role', None):
            try:
                rp = RolePermission.objects.get(role=user.role, permission=perm)
                return bool(rp.is_allowed)
            except RolePermission.DoesNotExist:
                pass

        # Department explicit
        if getattr(user, 'department', None):
            try:
                DepartmentPermission.objects.get(department=user.department, permission=perm)
                return True
            except DepartmentPermission.DoesNotExist:
                pass

        return False


# ⭐⭐⭐ ADD THIS PART ⭐⭐⭐
def get_effective_permissions(user):
    final = {}

    overrides = UserPermissionOverride.objects.filter(user=user)
    for o in overrides:
        final[o.permission.codename] = o.is_allowed

    if user.role_id:
        role_perms = RolePermission.objects.filter(role_id=user.role_id)
        for rp in role_perms:
            if rp.permission.codename not in final:
                final[rp.permission.codename] = rp.is_allowed

    if user.department_id:
        dept_perms = DepartmentPermission.objects.filter(department_id=user.department_id)
        for dp in dept_perms:
            if dp.permission.codename not in final:
                final[dp.permission.codename] = True

    return sorted([code for code, allowed in final.items() if allowed])
