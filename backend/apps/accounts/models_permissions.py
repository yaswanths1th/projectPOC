# backend/apps/accounts/models_permissions.py
from django.db import models
from django.conf import settings

# import your existing models
# adjust imports if your models are named differently or live elsewhere in the app
from .models import Role, Department  # assume these exist in models.py
from django.apps import apps

User = apps.get_model('accounts', 'User')  # safer import

class Permission(models.Model):
    id = models.AutoField(primary_key=True)
    codename = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'permissions'
        ordering = ['codename']

    def __str__(self):
        return f"{self.codename} ({self.name})"

class DepartmentPermission(models.Model):
    department = models.ForeignKey(Department, on_delete=models.CASCADE, db_index=True)
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)
    
    class Meta:
        db_table = 'department_permissions'
        unique_together = ('department', 'permission')

    def __str__(self):
        return f"{self.department} -> {self.permission.codename}"

class RolePermission(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE, db_index=True)
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)
    is_allowed = models.BooleanField(default=True)

    class Meta:
        db_table = 'role_permissions'
        unique_together = ('role', 'permission')

    def __str__(self):
        return f"{self.role} -> {self.permission.codename} ({'allow' if self.is_allowed else 'deny'})"

class UserPermissionOverride(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_index=True)
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)
    is_allowed = models.BooleanField()  # explicit allow or deny

    class Meta:
        db_table = 'user_permission_override'
        unique_together = ('user', 'permission')

    def __str__(self):
        return f"{self.user} -> {self.permission.codename} ({'allow' if self.is_allowed else 'deny'})"
