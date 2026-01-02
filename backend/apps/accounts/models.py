from django.db import models
from django.contrib.auth.models import AbstractUser
import uuid
from django.utils import timezone
from datetime import timedelta
# ===========================
# ✅ Tenant Model (Multi-Tenant SaaS)
# ===========================
class Tenant(models.Model):
    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(max_length=50, unique=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "accounts_tenant"

    def __str__(self):
        return self.name


# ===========================
# ✅ Department Model
# ===========================
class Department(models.Model):
    tenant = models.ForeignKey("Tenant", on_delete=models.CASCADE, null=True, blank=True)
    department_name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("tenant", "department_name")
        db_table = "department"
    def __str__(self):
        return self.department_name


# ===========================
# ✅ Role Model
# ===========================
class Role(models.Model):
    tenant = models.ForeignKey("Tenant", on_delete=models.CASCADE, null=True, blank=True)
    role_name = models.CharField(max_length=100)
    department = models.ForeignKey(Department, on_delete=models.CASCADE)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("tenant", "role_name", "department")
        db_table = "roles"
    def __str__(self):
        return self.role_name


# ===========================
# ✅ Custom User Model
# ===========================
class User(AbstractUser):
    tenant = models.ForeignKey(Tenant, null=True, blank=True, on_delete=models.CASCADE)

    is_superadmin = models.BooleanField(default=False)
    is_tenant_admin = models.BooleanField(default=False)

    username = models.CharField(
        max_length=150,
        unique=True,
        help_text="Required. 150 chars or fewer.",
    )

    email = models.EmailField(max_length=254, blank=True)

    phone = models.CharField(max_length=15, blank=True, null=True)
    department = models.ForeignKey(Department, null=True, blank=True, on_delete=models.SET_NULL)
    role = models.ForeignKey(Role, null=True, blank=True, on_delete=models.SET_NULL)

    def __str__(self):
        return self.username

# ===========================
# ✅ User Error Messages
# Maps to existing DB table: user_error
# ===========================
class UserError(models.Model):
    error_code = models.CharField(max_length=10, unique=True)
    error_message = models.CharField(max_length=255)

    class Meta:
        db_table = "user_error"  # ✅ important fix

    def __str__(self):
        return f"{self.error_code} - {self.error_message}"


# ===========================
# ✅ User Information Messages
# Maps to existing DB table: user_information
# ===========================
class UserInformation(models.Model):
    information_code = models.CharField(max_length=10, unique=True)
    information_text = models.CharField(max_length=255)

    class Meta:
        db_table = "user_information"  # ✅ important fix

    def __str__(self):
        return f"{self.information_code} - {self.information_text}"


# ===========================
# ✅ User Validation Messages
# Maps to existing DB table: user_validation
# ===========================
class UserValidation(models.Model):
    validation_code = models.CharField(max_length=10, unique=True)
    validation_message = models.CharField(max_length=255)

    class Meta:
        db_table = "user_validation"  # ✅ important fix

    def __str__(self):
        return f"{self.validation_code} - {self.validation_message}"

class UserInvite(models.Model):
    email = models.EmailField(max_length=254)
    tenant = models.ForeignKey("Tenant", on_delete=models.CASCADE, related_name="invites")
    code = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)
    invited_by = models.ForeignKey(
        "User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_invites"
    )

    class Meta:
        db_table = "user_invite"
        indexes = [
            models.Index(fields=["code"]),
            models.Index(fields=["email"])
        ]

    def __str__(self):
        return f"Invite {self.email} -> {self.tenant.slug} ({'used' if self.used else 'open'})"

    @classmethod
    def create_invite(cls, email, tenant, invited_by=None, days_valid: int = 3):
        code = uuid.uuid4().hex
        expires_at = timezone.now() + timedelta(days=days_valid)
        return cls.objects.create(email=email, tenant=tenant, code=code, expires_at=expires_at, invited_by=invited_by)
