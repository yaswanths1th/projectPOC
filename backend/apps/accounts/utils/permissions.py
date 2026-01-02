# apps/accounts/utils/permissions.py

from apps.accounts.models_permissions import (
    RolePermission,
    DepartmentPermission,
    UserPermissionOverride,
)

def get_effective_permissions(user):
    final = {}

    # User overrides
    for o in UserPermissionOverride.objects.filter(user=user):
        final[o.permission.codename] = o.is_allowed

    # Role permissions
    if user.role_id:
        for rp in RolePermission.objects.filter(role_id=user.role_id):
            if rp.permission.codename not in final:
                final[rp.permission.codename] = rp.is_allowed

    # Department permissions (always allow)
    if user.department_id:
        for dp in DepartmentPermission.objects.filter(department_id=user.department_id):
            if dp.permission.codename not in final:
                final[dp.permission.codename] = True

    return sorted([code for code, allowed in final.items() if allowed])
