# =====================================================================
# 🔐 FULLY SECURE COOKIE-BASED AUTHENTICATION SYSTEM
# =====================================================================

from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils import timezone
from datetime import timedelta

from rest_framework import generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

import random
import logging

# Models
from .models import (
    User, Department, Role,
    UserError, UserInformation, UserValidation,
    LoginOTP
)

# Serializers
from .serializers import (
    RegisterSerializer, UserSerializer,
    DepartmentSerializer, RoleSerializer
)

# Permissions system
from .models_permissions import (
    Permission, DepartmentPermission,
    RolePermission, UserPermissionOverride
)

from .permissions import IsRoleAdmin
from .constants import DEFAULT_MESSAGES


User = get_user_model()
logger = logging.getLogger(__name__)


# =====================================================================
# 🔐 HELPER: Get Effective Permissions
# =====================================================================
def get_effective_permissions(user):
    """🔐 Merge permissions from user, role, and department"""
    final = {}

    # User-specific overrides (highest priority)
    overrides = UserPermissionOverride.objects.filter(user=user)
    for o in overrides:
        final[o.permission.codename] = o.is_allowed

    # Role-based permissions
    if user.role_id:
        role_perms = RolePermission.objects.filter(role_id=user.role_id)
        for rp in role_perms:
            if rp.permission.codename not in final:
                final[rp.permission.codename] = rp.is_allowed

    # Department-based permissions
    if user.department_id:
        dept_perms = DepartmentPermission.objects.filter(department_id=user.department_id)
        for dp in dept_perms:
            if dp.permission.codename not in final:
                final[dp.permission.codename] = True

    return sorted([code for code, allowed in final.items() if allowed])


# =====================================================================
# 🔐 HELPER: Set JWT Cookies in Response
# =====================================================================
def set_jwt_cookies(response, access_token, refresh_token):
    """🔐 Set HttpOnly, Secure, SameSite cookies"""
    response.set_cookie(
        key="access_token",
        value=str(access_token),
        max_age=30 * 60,  # 30 minutes
        httponly=True,
        secure=True,  # Required for SameSite=None
        samesite="None",  # Allow cross-domain cookies
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=str(refresh_token),
        max_age=24 * 60 * 60,  # 24 hours
        httponly=True,
        secure=True,  # Required for SameSite=None
        samesite="None",  # Allow cross-domain cookies
        path="/",
    )
    return response


# =====================================================================
# 🔐 DIRECT LOGIN (USERNAME + PASSWORD)
# =====================================================================
@api_view(['POST'])
@permission_classes([AllowAny])
def login_init(request):
    """
    Direct login without OTP:
    - Validate username & password
    - Issue JWT tokens
    - Set HttpOnly cookies
    """
    username = request.data.get("username", "").strip()
    password = request.data.get("password", "").strip()

    if not username or not password:
        return Response({"code": "EV001"}, status=400)

    # Validate user exists and password correct
    user = User.objects.filter(username__iexact=username).first()
    if not user or not user.check_password(password):
        # 🔐 Don't reveal whether user exists
        return Response({"code": "EL001"}, status=401)

    if not user.is_active:
        return Response({"code": "EL002"}, status=403)

    # 🔐 Generate JWT tokens
    refresh = RefreshToken.for_user(user)
    access = refresh.access_token

    # 🔐 Prepare user response
    permissions = get_effective_permissions(user)
    user_data = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "is_admin": user.is_staff,
        "is_active": user.is_active,
        "department": user.department_id,
        "role": user.role_id,
        "permissions": permissions,
    }

    response = Response(
        {
            "user": user_data,
            "message": "Login successful"
        },
        status=200
    )

    return set_jwt_cookies(response, access, refresh)


# =====================================================================
# 🔐 OTP VERIFICATION ENDPOINT (DISABLED - Using direct login instead)
# =====================================================================
# @api_view(['POST'])
# @permission_classes([AllowAny])
# def login_verify_otp(request):
#     """
#     Step 2 of 2FA Login (DISABLED):
#     - Verify OTP
#     - Issue JWT tokens
#     - Set HttpOnly cookies
#     """
#     pass


# =====================================================================
# 🔐 LOGOUT (Delete cookies + blacklist token)
# =====================================================================
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """
    Logout endpoint:
    - Clear access/refresh cookies
    - Blacklist refresh token (optional)
    """
    response = Response(
        {"code": "IL002", "message": "Logged out successfully"},
        status=200
    )

    # 🔐 Delete cookies
    response.delete_cookie("access_token", path="/", samesite="None", secure=True)
    response.delete_cookie("refresh_token", path="/", samesite="None", secure=True)

    # 🔐 Optional: Blacklist the refresh token (requires TokenBlacklist app)
    try:
        refresh_token = request.COOKIES.get("refresh_token")
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
    except Exception as e:
        logger.warning(f"Token blacklist failed: {e}")

    return response


# =====================================================================
# 🔐 LEGACY JWT LOGIN (For backward compatibility with admin/mobile)
# =====================================================================
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        try:
            data = super().validate(attrs)
        except Exception:
            raise AuthenticationFailed({"code": "EL001"})

        user = self.user
        if not user.is_active:
            raise AuthenticationFailed({"code": "EL002"})

        permissions = get_effective_permissions(user)
        is_admin = user.is_staff or user.is_superuser

        data.update({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role_id": user.role_id,
            "role_name": user.role.role_name if user.role else None,
            "is_admin": is_admin,
            "permissions": permissions,
        })

        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_scope = "login"


# =====================================================================
# 🔓 TOKEN REFRESH (from cookies → issue new cookie)
# =====================================================================
@api_view(['POST'])
@permission_classes([AllowAny])
def refresh_token_view(request):
    """
    Refresh JWT from cookie:
    - Read refresh_token from cookie
    - Issue new access token
    - Set new access cookie
    """
    refresh_token = request.COOKIES.get("refresh_token")
    
    if not refresh_token:
        return Response({"code": "EL006", "error": "Refresh token missing"}, status=401)

    try:
        refresh = RefreshToken(refresh_token)
        new_access = refresh.access_token
        
        response = Response(
            {"code": "IL003", "message": "Token refreshed"},
            status=200
        )
        
        # 🔐 Set new access token cookie
        response.set_cookie(
            key="access_token",
            value=str(new_access),
            max_age=30 * 60,
            httponly=True,
            secure=False,  # localhost
            samesite="Lax",
            path="/",
        )
        
        return response
    except Exception as e:
        logger.error(f"Token refresh failed: {e}")
        return Response({"code": "EL007", "error": "Invalid refresh token"}, status=401)


# =====================================================================
# 👤 PROFILE — GET & UPDATE
# =====================================================================
class ProfileAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get user profile with permissions"""
        user = request.user
        permissions = get_effective_permissions(user)
        
        data = UserSerializer(user).data
        data.update({
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
            "is_admin": user.is_staff or user.is_superuser,
            "permissions": permissions,
        })

        return Response(data, status=200)

    def put(self, request):
        """Update user profile (role/department locked)"""
        serializer = UserSerializer(request.user, data=request.data, partial=True, context={"request": request})

        if serializer.is_valid():
            serializer.save()
            return Response({"code": "IP001", "message": "Profile updated"}, status=200)

        return Response(serializer.errors, status=400)


# =====================================================================
# 📝 REGISTER USER
# =====================================================================
@api_view(['POST'])
@permission_classes([AllowAny])
def register_user(request):
    """Register new user (default role: User)"""
    serializer = RegisterSerializer(data=request.data)

    if serializer.is_valid():
        serializer.save()
        return Response({"code": "IR001", "message": "Registration successful"}, status=201)

    return Response(serializer.errors, status=400)


# =====================================================================
# 🔍 CHECK USERNAME (AJAX)
# =====================================================================
@api_view(['GET'])
@permission_classes([AllowAny])
def check_username(request):
    """Check if username exists"""
    username = request.query_params.get("username", "").strip()

    if not username:
        return Response({"detail": "username query param required"}, status=400)

    exists = User.objects.filter(username__iexact=username).exists()
    return Response({"exists": exists}, status=200)


# =====================================================================
# 🔍 CHECK EMAIL (AJAX)
# =====================================================================
@api_view(['GET'])
@permission_classes([AllowAny])
def check_email(request):
    """Check if email exists"""
    email = request.query_params.get("email", "").strip()

    if not email:
        return Response({"detail": "email query param required"}, status=400)

    exists = User.objects.filter(email__iexact=email).exists()
    return Response({"exists": exists}, status=200)


# =====================================================================
# 👑 ADMIN — LIST + CREATE USERS
# =====================================================================
class AdminUserListCreateAPIView(generics.ListCreateAPIView):
    queryset = User.objects.all().order_by("-id")
    serializer_class = UserSerializer
    permission_classes = [IsRoleAdmin]

    def create(self, request, *args, **kwargs):
        """🔐 Create user with secure defaults"""
        data = request.data.copy()

        # Auto-assign department
        if not data.get("department"):
            general = Department.objects.filter(
                department_name__iexact="General",
                is_active=True
            ).first()
            if general:
                data["department"] = general.id

        # Auto-assign role
        if not data.get("role") and data.get("department"):
            default_role = Role.objects.filter(
                role_name__iexact="User",
                department_id=data["department"],
                is_active=True
            ).first()
            if default_role:
                data["role"] = default_role.id

        # 🔐 Validate password strength
        password = request.data.get("password")
        if not password:
            return Response({"password": "Password required"}, status=400)

        try:
            validate_password(password)
        except Exception as e:
            return Response({"password": list(e.messages)}, status=400)

        serializer = self.get_serializer(data=data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        user = serializer.save()
        user.set_password(password)
        user.save()

        return Response({"code": "IR001", "id": user.id}, status=201)


# =====================================================================
# 👑 ADMIN — RETRIEVE + UPDATE + DELETE USER
# =====================================================================
class AdminUserUpdateDeleteAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsRoleAdmin]

    def destroy(self, request, *args, **kwargs):
        """🔐 Delete user"""
        user = self.get_object()
        user.delete()
        return Response({"code": "ID001", "message": "User deleted"}, status=200)


# =====================================================================
# 👑 ADMIN — TOGGLE USER ACTIVE/INACTIVE
# =====================================================================
@api_view(["POST"])
@permission_classes([IsRoleAdmin])
def user_toggle_active(request, pk):
    """🔐 Toggle user active status (admin only)"""
    try:
        user = User.objects.get(pk=pk)
        user.is_active = not user.is_active
        user.save()
        return Response({"code": "IP001", "message": "User status updated"}, status=200)
    except User.DoesNotExist:
        return Response({"code": "GEN001"}, status=404)


# =====================================================================
# 👑 ADMIN — BASIC STATS
# =====================================================================
class AdminUserStatsAPIView(generics.GenericAPIView):
    permission_classes = [IsRoleAdmin]

    def get(self, request):
        """Get user statistics"""
        return Response({
            "total_users": User.objects.count(),
            "active_users": User.objects.filter(is_active=True).count(),
            "inactive_users": User.objects.filter(is_active=False).count(),
        }, status=200)


# =====================================================================
# 🏢 DEPARTMENTS — LIST + CREATE
# =====================================================================
class DepartmentListCreateAPIView(generics.ListCreateAPIView):
    queryset = Department.objects.all().order_by("department_name")
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsRoleAdmin()]


# =====================================================================
# 🏢 DEPARTMENTS — RETRIEVE + UPDATE + DELETE
# =====================================================================
class DepartmentRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsRoleAdmin]


# =====================================================================
# 🏢 DEPARTMENT — TOGGLE ACTIVE
# =====================================================================
@api_view(["POST"])
@permission_classes([IsRoleAdmin])
def department_toggle_active(request, pk):
    """🔐 Toggle department active status"""
    try:
        dept = Department.objects.get(pk=pk)
        dept.is_active = not dept.is_active
        dept.save()
        return Response({"code": "IP001"}, status=200)
    except Department.DoesNotExist:
        return Response({"code": "GEN001"}, status=404)


# =====================================================================
# 🧩 ROLES — LIST + CREATE
# =====================================================================
class RoleListCreateAPIView(generics.ListCreateAPIView):
    queryset = Role.objects.all().order_by("role_name")
    serializer_class = RoleSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsRoleAdmin()]


# =====================================================================
# 🧩 ROLES — RETRIEVE + UPDATE + DELETE
# =====================================================================
class RoleRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsRoleAdmin]


# =====================================================================
# 🧩 ROLE — TOGGLE ACTIVE
# =====================================================================
@api_view(["POST"])
@permission_classes([IsRoleAdmin])
def role_toggle_active(request, pk):
    """🔐 Toggle role active status"""
    try:
        role = Role.objects.get(pk=pk)
        role.is_active = not role.is_active
        role.save()
        return Response({"code": "IP001"}, status=200)
    except Role.DoesNotExist:
        return Response({"code": "GEN001"}, status=404)


# =====================================================================
# 📧 SEND USER CREDENTIALS (Admin only)
# =====================================================================
@api_view(['POST'])
@permission_classes([IsRoleAdmin])
def send_user_credentials(request):
    """🔐 Send login credentials to user email"""
    email = request.data.get("email", "").strip()
    username = request.data.get("username", "").strip()
    password = request.data.get("password", "").strip()

    if not email or not username:
        return Response({"email": "Required fields missing"}, status=400)

    message = f"""
Hello {username},

Your account has been created.

Login URL: http://localhost:5173/login

Username: {username}
Password: {password}

⚠️ Change your password after first login.
"""

    try:
        send_mail(
            "Your Login Credentials",
            message,
            settings.DEFAULT_FROM_EMAIL,
            [email],
            fail_silently=False
        )
        return Response({"code": "IG001", "message": "Credentials sent"}, status=200)
    except Exception as e:
        logger.error(f"Email send error: {e}")
        return Response({"code": "GEN002", "error": "Email send failed"}, status=500)


# =====================================================================
# 💬 MERGED SYSTEM MESSAGES API
# =====================================================================
@api_view(["GET"])
@permission_classes([AllowAny])
def get_messages(request):
    """Get all system messages (errors, validations, info)"""
    try:
        user_error = list(UserError.objects.values("error_code", "error_message"))
        user_validation = list(UserValidation.objects.values("validation_code", "validation_message"))
        user_information = list(UserInformation.objects.values("information_code", "information_text"))
    except Exception:
        user_error, user_validation, user_information = [], [], []

    # Append defaults if missing
    existing_error = {e["error_code"] for e in user_error}
    for code, msg in DEFAULT_MESSAGES["ERRORS"].items():
        if code not in existing_error:
            user_error.append({"error_code": code, "error_message": msg})

    existing_validation = {v["validation_code"] for v in user_validation}
    for code, msg in DEFAULT_MESSAGES["VALIDATIONS"].items():
        if code not in existing_validation:
            user_validation.append({"validation_code": code, "validation_message": msg})

    existing_info = {i["information_code"] for i in user_information}
    for code, msg in DEFAULT_MESSAGES["INFORMATION"].items():
        if code not in existing_info:
            user_information.append({"information_code": code, "information_text": msg})

    return Response({
        "user_error": user_error,
        "user_validation": user_validation,
        "user_information": user_information,
    }, status=200)


# =====================================================================
# 🔐 HELPER: Get Client IP
# =====================================================================
def get_client_ip(request):
    """Get client IP for rate limiting & logging"""
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        ip = x_forwarded_for.split(",")[0].strip()
    else:
        ip = request.META.get("REMOTE_ADDR", "unknown")
    return ip
