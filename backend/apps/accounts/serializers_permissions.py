# backend/apps/accounts/serializers_permissions.py
from rest_framework import serializers
from .models_permissions import Permission, DepartmentPermission, RolePermission, UserPermissionOverride
from django.apps import apps

Role = apps.get_model('accounts', 'Role')
Department = apps.get_model('accounts', 'Department')
User = apps.get_model('accounts', 'User')

class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ['id', 'codename', 'name', 'description']

class RolePermissionSerializer(serializers.ModelSerializer):
    permission = PermissionSerializer(read_only=True)
    permission_id = serializers.PrimaryKeyRelatedField(queryset=Permission.objects.all(), source='permission', write_only=True)

    class Meta:
        model = RolePermission
        fields = ['id', 'role', 'permission', 'permission_id', 'is_allowed']

class DepartmentPermissionSerializer(serializers.ModelSerializer):
    permission = PermissionSerializer(read_only=True)
    permission_id = serializers.PrimaryKeyRelatedField(queryset=Permission.objects.all(), source='permission', write_only=True)

    class Meta:
        model = DepartmentPermission
        fields = ['id', 'department', 'permission', 'permission_id']

class UserPermissionOverrideSerializer(serializers.ModelSerializer):
    permission = PermissionSerializer(read_only=True)
    permission_id = serializers.PrimaryKeyRelatedField(queryset=Permission.objects.all(), source='permission', write_only=True)

    class Meta:
        model = UserPermissionOverride
        fields = ['id', 'user', 'permission', 'permission_id', 'is_allowed']
