from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password  # 🔐 SECURITY FIX: Added strong password validator
from django.core.validators import validate_email                     # 🔐 SECURITY FIX: Email format validator added
from django.core.exceptions import ValidationError
from .models import User, Department, Role


# =====================================================================
# ✅ Department Serializer — No changes needed
# =====================================================================
class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'department_name', 'is_active']
        extra_kwargs = {"is_active": {"required": False}}


# =====================================================================
# ✅ Role Serializer — No changes needed
# =====================================================================
class RoleSerializer(serializers.ModelSerializer):
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all())

    class Meta:
        model = Role
        fields = ['id', 'role_name', 'department', 'is_active']
        extra_kwargs = {"is_active": {"required": False}}


# =====================================================================
# ✅ User Serializer (Hardened)
# =====================================================================
class UserSerializer(serializers.ModelSerializer):
    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(), allow_null=True
    )
    role = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(), allow_null=True
    )

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name",
            "email", "phone", "is_active", "date_joined",
            "department", "role",
        ]
        read_only_fields = ["id", "date_joined"]

    # ----------------------------------------------------
    # 🔐 SECURITY FIX: Strong username validation
    # ----------------------------------------------------
    def validate_username(self, value):
        # ❌ OLD (missing allowed characters check)
        # if qs.exists(): raise error
        
        # ✅ FIXED
        if not value.isalnum():
            raise serializers.ValidationError("Username must be alphanumeric")

        qs = User.objects.filter(username__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("EP016")
        return value

    # ----------------------------------------------------
    # 🔐 SECURITY FIX: Strong email validation
    # ----------------------------------------------------
    def validate_email(self, value):
        # ❌ OLD (email format not checked)
        # qs = User.objects.filter(email__iexact=value)

        # ✅ FIXED — now checks email format first
        try:
            validate_email(value)
        except ValidationError:
            raise serializers.ValidationError("Invalid email format")

        qs = User.objects.filter(email__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("ES003")
        return value

    # ----------------------------------------------------
    # 🔐 SECURITY FIX: Prevent normal users from modifying role/department
    # ----------------------------------------------------
    def validate(self, attrs):
        request = self.context.get("request")

        # ❌ OLD: User could change their role manually → major security risk
        # No check existed

        # ✅ FIXED:
        if request and not (request.user.is_staff or request.user.is_superuser):
            if "role" in attrs or "department" in attrs:
                raise serializers.ValidationError("Not allowed to modify role/department")

        return attrs


# =====================================================================
# ✅ Register Serializer (MOST IMPORTANT SECURITY AREA)
# =====================================================================
class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "phone", "password",
            "first_name", "last_name",
        ]

    # ----------------------------------------------------
    # 🔐 SECURITY FIX: Strong validation
    # ----------------------------------------------------
    def validate(self, data):

        # ❌ OLD: no username format check
        # user could register with "admin!!!" or "aaa^^%%123"

        # ✅ FIXED:
        if not data["username"].isalnum():
            raise serializers.ValidationError({"username": "Username must be alphanumeric"})

        # ❌ OLD: Email not validated for format
        # "abc@com" or "xyz" was accepted

        # ✅ FIXED:
        try:
            validate_email(data["email"])
        except ValidationError:
            raise serializers.ValidationError({"email": "Invalid email"})

        # ❌ OLD: Password not validated
        # Weak passwords like "123" worked

        # ✅ FIXED:
        try:
            validate_password(data["password"])
        except ValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})

        # Existing checks preserved
        if User.objects.filter(username__iexact=data["username"]).exists():
            raise serializers.ValidationError({"username": "EP016"})

        if User.objects.filter(email__iexact=data["email"]).exists():
            raise serializers.ValidationError({"email": "ES003"})

        return data

    # ----------------------------------------------------
    # 🔐 SECURITY FIX: Do NOT allow user to send role/department manually
    # ----------------------------------------------------
    def create(self, validated_data):

        # ❌ OLD:
        # User could manually send:
        # "role": 1  ← and become admin
        #
        # 🚨 SECURITY HOLE (Critical)

        # 🔥 FIX: Remove role and department from user input
        validated_data.pop("role", None)
        validated_data.pop("department", None)

        password = validated_data.pop("password")

        # Assign secure default department
        department = Department.objects.filter(
            department_name__iexact="General",
            is_active=True
        ).first()

        # Assign secure default role
        role = None
        if department:
            role = Role.objects.filter(
                role_name__iexact="User",
                department=department,
                is_active=True
            ).first()

        # Create user safely
        user = User(
            **validated_data,
            department=department,
            role=role
        )

        user.set_password(password)
        user.save()
        return user
