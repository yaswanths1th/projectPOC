from django.core.management.base import BaseCommand
from apps.accounts.models import Tenant, User, Department, Role

class Command(BaseCommand):
    help = "Assign ALL existing departments, roles and users to Default Company tenant"

    def handle(self, *args, **kwargs):
        
        # Create or fetch the default tenant
        tenant, created = Tenant.objects.get_or_create(
            slug="default",
            defaults={"name": "Default Company", "is_active": True},
        )

        self.stdout.write(self.style.SUCCESS(f"Using tenant: {tenant.name}"))

        # Assign all departments
        departments = Department.objects.filter(tenant__isnull=True)
        for dept in departments:
            dept.tenant = tenant
            dept.save()
        self.stdout.write(self.style.SUCCESS(f"Updated {departments.count()} departments"))

        # Assign all roles
        roles = Role.objects.filter(tenant__isnull=True)
        for role in roles:
            role.tenant = tenant
            role.save()
        self.stdout.write(self.style.SUCCESS(f"Updated {roles.count()} roles"))

        # Assign all users
        users = User.objects.filter(tenant__isnull=True)
        for user in users:
            user.tenant = tenant
            user.save()
        self.stdout.write(self.style.SUCCESS(f"Updated {users.count()} users"))

        self.stdout.write(self.style.SUCCESS("Tenant assignment complete."))
