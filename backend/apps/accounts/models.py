from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
from datetime import timedelta
import uuid


# =====================================================================
# ✅ Department Model
# =====================================================================
class Department(models.Model):
    department_name = models.CharField(max_length=100, unique=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.department_name


# =====================================================================
# ✅ Role Model
# =====================================================================
class Role(models.Model):
    role_name = models.CharField(max_length=100)
    department = models.ForeignKey(Department, on_delete=models.CASCADE)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("role_name", "department")

    def __str__(self):
        return self.role_name


# =====================================================================
# ✅ Custom User Model
# =====================================================================
class User(AbstractUser):
    """
    Extended User Model with department + role
    """
    username = models.CharField(
        max_length=150,
        unique=True,
        help_text="Required. 150 characters or fewer.",
    )

    email = models.EmailField(max_length=254, blank=True)
    phone = models.CharField(max_length=15, blank=True, null=True)

    department = models.ForeignKey(
        Department, null=True, blank=True, on_delete=models.SET_NULL
    )
    role = models.ForeignKey(
        Role, null=True, blank=True, on_delete=models.SET_NULL
    )

    def __str__(self):
        return self.username


# =====================================================================
# ✅ User Error Messages  (DB Table: user_error)
# =====================================================================
class UserError(models.Model):
    error_code = models.CharField(max_length=10, unique=True)
    error_message = models.CharField(max_length=255)

    class Meta:
        db_table = "user_error"

    def __str__(self):
        return f"{self.error_code} - {self.error_message}"


# =====================================================================
# ✅ User Information Messages  (DB Table: user_information)
# =====================================================================
class UserInformation(models.Model):
    information_code = models.CharField(max_length=10, unique=True)
    information_text = models.CharField(max_length=255)

    class Meta:
        db_table = "user_information"

    def __str__(self):
        return f"{self.information_code} - {self.information_text}"


# =====================================================================
# ✅ User Validation Messages  (DB Table: user_validation)
# =====================================================================
class UserValidation(models.Model):
    validation_code = models.CharField(max_length=10, unique=True)
    validation_message = models.CharField(max_length=255)

    class Meta:
        db_table = "user_validation"

    def __str__(self):
        return f"{self.validation_code} - {self.validation_message}"


# =====================================================================
# 🔐 Login OTP Model (2FA) — ADDED & FULLY INTEGRATED
# =====================================================================
class LoginOTP(models.Model):
    """
    Stores OTP for secure 2-step authentication.
    Linked to User model above.
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    session_id = models.UUIDField(default=uuid.uuid4, unique=True)
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    failed_attempts = models.IntegerField(default=0)
    client_ip = models.CharField(max_length=50, default="unknown")  # 🔐 Track IP
    otp_sent_at = models.DateTimeField(null=True, blank=True)       # 🔐 Track cooldown

    OTP_EXPIRY_MINUTES = 5  # OTP expires in 5 minutes

    @property
    def is_expired(self):
        return timezone.now() > (self.created_at + timedelta(minutes=self.OTP_EXPIRY_MINUTES))

    @property
    def is_in_cooldown(self):
        """🔐 60-second cooldown between OTP sends"""
        if not self.otp_sent_at:
            return False
        cooldown_time = self.otp_sent_at + timedelta(seconds=60)
        return timezone.now() < cooldown_time

    def __str__(self):
        return f"OTP for {self.user.username}"
