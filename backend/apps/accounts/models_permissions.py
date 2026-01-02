# backend/apps/accounts/models_permissions.py

from django.db import models
from django.conf import settings
from django.apps import apps

# Import related models
User = apps.get_model("accounts", "User")
Role = apps.get_model("accounts", "Role")
Department = apps.get_model("accounts", "Department")
Tenant = apps.get_model("accounts", "Tenant")


# ==========================================================
#  PERMISSION MODEL (GLOBAL)
# ==========================================================
class Permission(models.Model):
    """
    Permissions remain GLOBAL, reusable across tenants.
    Example: can_view_dashboard, can_edit_user, can_manage_roles.
    """
    id = models.AutoField(primary_key=True)
    codename = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "permissions"
        ordering = ["codename"]

    def __str__(self):
        return f"{self.codename} ({self.name})"


# ==========================================================
#  DEPARTMENT PERMISSION (TENANT-AWARE)
# ==========================================================
class DepartmentPermission(models.Model):
    """
    Permissions assigned to a Department.
    Tenant is inferred via department.tenant
    """
    department = models.ForeignKey(Department, on_delete=models.CASCADE, db_index=True)
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)

    class Meta:
        db_table = "department_permissions"
        unique_together = ("department", "permission")

    def __str__(self):
        return f"{self.department} -> {self.permission.codename}"


# ==========================================================
#  ROLE PERMISSION (TENANT-AWARE)
# ==========================================================
class RolePermission(models.Model):
    """
    True RBAC mapping:
    Role (tenant-based) → Permission → allow/deny
    """
    role = models.ForeignKey(Role, on_delete=models.CASCADE, db_index=True)
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)
    is_allowed = models.BooleanField(default=True)

    class Meta:
        db_table = "role_permissions"
        unique_together = ("role", "permission")

    def __str__(self):
        return f"{self.role} -> {self.permission.codename} ({'allow' if self.is_allowed else 'deny'})"


# ==========================================================
#  USER PERMISSION OVERRIDE (MOST POWERFUL)
# ==========================================================
class UserPermissionOverride(models.Model):
    """
    Overrides > Role > Department.
    Each tenant user can have explicit allow/deny.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_index=True)
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)
    is_allowed = models.BooleanField()  # True = allow, False = deny

    class Meta:
        db_table = "user_permission_override"
        unique_together = ("user", "permission")

    def __str__(self):
        return f"{self.user} -> {self.permission.codename} ({'allow' if self.is_allowed else 'deny'})"


# ==========================================================
#  EFFECTIVE PERMISSION RESOLUTION (TENANT ENFORCED)
# ==========================================================
def get_effective_permissions(user):
    """
    Final output = list of permission codenames user is allowed to use.

    Priority:
        1️⃣ SuperAdmin -> ALL permissions globally
        2️⃣ UserOverride
        3️⃣ Role permissions
        4️⃣ Department permissions
    """

    # --------------------------------------------
    # 1️⃣ SuperAdmin: Allow ALL permissions
    # --------------------------------------------
    if getattr(user, "is_superadmin", False):
        return list(Permission.objects.values_list("codename", flat=True))

    final = {}

    tenant_id = getattr(user.tenant, "id", None)

    # --------------------------------------------
    # 2️⃣ User Overrides (tenant-aware)
    # --------------------------------------------
    overrides = UserPermissionOverride.objects.filter(user=user)
    for o in overrides:
        final[o.permission.codename] = o.is_allowed

    # --------------------------------------------
    # 3️⃣ Role permissions
    # --------------------------------------------
    if user.role_id:
        role_perms = RolePermission.objects.filter(role_id=user.role_id)

        # ensure permission belongs to same tenant
        role_perms = role_perms.filter(role__tenant_id=tenant_id)

        for rp in role_perms:
            if rp.permission.codename not in final:
                final[rp.permission.codename] = rp.is_allowed

    # --------------------------------------------
    # 4️⃣ Department permissions
    # --------------------------------------------
    if user.department_id:
        dept_perms = DepartmentPermission.objects.filter(department_id=user.department_id)

        # match tenant
        dept_perms = dept_perms.filter(department__tenant_id=tenant_id)

        for dp in dept_perms:
            if dp.permission.codename not in final:
                # department always ALLOWS
                final[dp.permission.codename] = True

    # --------------------------------------------
    # Return only allowed permissions
    # --------------------------------------------
    allowed = [code for code, allowed in final.items() if allowed]
    return sorted(allowed)
