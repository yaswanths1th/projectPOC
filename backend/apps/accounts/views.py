# backend/apps/accounts/views.py
import os
import logging
import random
from datetime import timedelta

from django.core.mail import send_mail
from django.contrib.auth import get_user_model
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes

from django.conf import settings
from django.core.cache import cache
from rest_framework.exceptions import AuthenticationFailed
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.decorators import api_view, permission_classes
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models_permissions import (
    Permission, DepartmentPermission, RolePermission, UserPermissionOverride
)
from .permissions import IsRoleAdmin

from .models import (
    User, Department, Role,
    UserError, UserInformation, UserValidation
)
from .serializers import (
    RegisterSerializer, UserSerializer, DepartmentSerializer, RoleSerializer
)
from .constants import DEFAULT_MESSAGES

logger = logging.getLogger(__name__)
User = get_user_model()

OTP_EXPIRY_MINUTES = int(getattr(settings, "OTP_EXPIRY_MINUTES", 5))
FRONTEND_PUBLIC_URL = os.getenv("FRONTEND_PUBLIC_URL", "http://localhost:5173")

# Registration
@api_view(['POST'])
@permission_classes([AllowAny])
def register_user(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response({"code": "IR001"}, status=201)
    return Response(serializer.errors, status=400)

# Login serializer
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        try:
            data = super().validate(attrs)
        except Exception:
            # raise 401 instead of returning 200
            raise AuthenticationFailed(detail={"code": "EL001"})

        user = self.user
        permissions = get_effective_permissions(user)

        data.update({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "is_admin": bool(user.is_staff or user.is_superuser or (user.role_id and user.role_id != 2)),
            "role_id": user.role_id,
            "role_name": user.role.role_name if user.role else None,
            "permissions": permissions,
        })
        return data
class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        # Use parent to validate credentials and build tokens
        parent_response = super().post(request, *args, **kwargs)
        if parent_response.status_code != 200:
            return parent_response

        # parent_response.data contains access, refresh and user info
        data = parent_response.data.copy()
        access = data.pop("access", None)
        refresh = data.pop("refresh", None)

        payload = {
            "username": data.get("username"),
            "email": data.get("email"),
            "role_id": data.get("role_id"),
            "role_name": data.get("role_name"),
            "permissions": data.get("permissions", []),
            "is_admin": data.get("is_admin", False),
        }

        final = Response(payload, status=200)

        # set cookies
        if access:
            final.set_cookie(
            key="access_token",
            value=access,
            httponly=True,
            secure=False,          # since DEBUG=True
            samesite="None",       # <-- FIX
            path="/",
)
        if refresh:
            final.set_cookie(
            key="refresh_token",
            value=refresh,
            httponly=True,
            secure=False,
            samesite="None",
            path="/",
)


        return final

# Refresh token endpoint (reads refresh cookie and returns new access cookie)
@api_view(["POST"])
@permission_classes([AllowAny])
def refresh_token_view(request):
    refresh = request.COOKIES.get("refresh_token")
    if not refresh:
        return Response({"detail": "refresh_token_missing"}, status=400)
    try:
        token = RefreshToken(refresh)
        # create new access token
        new_access = token.access_token

        resp = Response({"code": "IRF001"}, status=200)
        resp.set_cookie(
    key="access_token",
    value=str(new_access),
    httponly=True,
    secure=False,
    samesite="None",
    path="/",
)

        return resp
    except Exception as e:
        logger.exception("refresh_token_error")
        return Response({"detail": "invalid_refresh"}, status=401)

# Logout endpoint clears cookies
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    resp = Response({"code": "IG002"}, status=200)
    resp.delete_cookie("access_token", path="/")
    resp.delete_cookie("refresh_token", path="/api/auth/token/refresh/")
    return resp

# Profile
class ProfileAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        data = UserSerializer(user).data
        permissions = get_effective_permissions(user)
        data.update({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role_id": user.role_id,
            "role_name": user.role.role_name if user.role else None,
            "permissions": permissions,
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
            "is_admin": user.is_staff or user.is_superuser or (user.role_id != 2)
        })
        return Response(data, status=200)

    def put(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({"code": "IP001"}, status=200)
        return Response(serializer.errors, status=400)

# Admin: Users
class AdminUserListCreateAPIView(generics.ListCreateAPIView):
    queryset = User.objects.all().order_by("-id")
    serializer_class = UserSerializer
    permission_classes = [IsRoleAdmin]

    def create(self, request, *args, **kwargs):
        data = request.data.copy()

        if not data.get("department"):
            general = Department.objects.filter(
                department_name__iexact="General", is_active=True
            ).first()
            if general:
                data["department"] = general.id

        if not data.get("role") and data.get("department"):
            default_role = Role.objects.filter(
                role_name__iexact="User",
                department_id=data["department"],
                is_active=True,
            ).first()
            if default_role:
                data["role"] = default_role.id

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)

        user = serializer.save()
        # DO NOT set password here when admin wants user to set via OTP.
        # If password provided, set it (still allowed)
        if request.data.get("password"):
            user.set_password(request.data.get("password"))
            user.save()

        return Response({"code": "IR001", "id": user.id}, status=201)

class AdminUserUpdateDeleteAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsRoleAdmin]

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        user.delete()
        return Response({"code": "ID001"}, status=200)

@api_view(["POST"])
@permission_classes([IsAdminUser])
def user_toggle_active(request, pk):
    try:
        user = User.objects.get(pk=pk)
        user.is_active = not user.is_active
        user.save()
        return Response({"code": "IP001"}, status=200)
    except User.DoesNotExist:
        return Response({"code": "GEN001"}, status=404)

# Admin stats
class AdminUserStatsAPIView(generics.GenericAPIView):
    permission_classes = [IsRoleAdmin]

    def get(self, request):
        return Response({
            "total_users": User.objects.count(),
            "active_users": User.objects.filter(is_active=True).count(),
            "hold_users": User.objects.filter(is_active=False).count(),
        }, status=200)

# Departments
class DepartmentListCreateAPIView(generics.ListCreateAPIView):
    queryset = Department.objects.all().order_by("department_name")
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        return [AllowAny()] if self.request.method == "GET" else [IsAdminUser()]

    def create(self, request, *args, **kwargs):
        name = (request.data.get("department_name") or "").strip()
        if not name:
            return Response({"department_name": "VA002"}, status=400)
        if Department.objects.filter(department_name__iexact=name).exists():
            return Response({"department_name": "EA003"}, status=400)

        Department.objects.create(
            department_name=name,
            is_active=request.data.get("is_active", True)
        )
        return Response({"code": "IG001"}, status=201)

class DepartmentRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsRoleAdmin]

@api_view(["POST"])
@permission_classes([IsAdminUser])
def department_toggle_active(request, pk):
    try:
        dept = Department.objects.get(pk=pk)
        dept.is_active = not dept.is_active
        dept.save()
        return Response({"code": "IP001"}, status=200)
    except Department.DoesNotExist:
        return Response({"code": "GEN001"}, status=404)

# Roles
class RoleListCreateAPIView(generics.ListCreateAPIView):
    queryset = Role.objects.all().order_by("role_name")
    serializer_class = RoleSerializer

    def get_permissions(self):
        return [AllowAny()] if self.request.method == "GET" else [IsAdminUser()]

    def create(self, request, *args, **kwargs):
        name = (request.data.get("role_name") or "").strip()
        dept = request.data.get("department")
        if not name or not dept:
            return Response({"role_name": "VA002"}, status=400)
        if Role.objects.filter(role_name__iexact=name, department_id=dept).exists():
            return Response({"role_name": "ER003"}, status=400)

        Role.objects.create(
            role_name=name,
            department_id=dept,
            is_active=request.data.get("is_active", True)
        )
        return Response({"code": "IG001"}, status=201)

class RoleRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsRoleAdmin]

@api_view(["POST"])
@permission_classes([IsAdminUser])
def role_toggle_active(request, pk):
    try:
        role = Role.objects.get(pk=pk)
        role.is_active = not role.is_active
        role.save()
        return Response({"code": "IP001"}, status=200)
    except Role.DoesNotExist:
        return Response({"code": "GEN001"}, status=404)

# SEND OTP INSTEAD OF PASSWORD
@api_view(['POST'])
@permission_classes([IsAdminUser])
def send_user_credentials(request):
    """
    Admin triggers OTP email to user so they can set their password.
    POST: { "email": "...", "username": "..." }
    """
    email = request.data.get("email")
    username = request.data.get("username")

    if not email or not username:
        return Response({"detail": "email_and_username_required"}, status=400)

    try:
        user = User.objects.get(username=username, email=email)
    except User.DoesNotExist:
        return Response({"detail": "user_not_found"}, status=404)

    # Generate OTP and cache it
    otp = "{:06d}".format(random.randint(0, 999999))
    cache_key = f"pwd_otp:{user.username}"
    cache.set(cache_key, otp, timeout=OTP_EXPIRY_MINUTES * 60)

    message = f"""
Hello {user.username},

Use the following one-time code to set your account password. This code will expire in {OTP_EXPIRY_MINUTES} minutes.

OTP: {otp}

Open the app and enter this code to set your password:
{FRONTEND_PUBLIC_URL}/verify-otp

If you did not request this, ignore this email.
"""
    try:
        send_mail("Set your account password", message, settings.DEFAULT_FROM_EMAIL, [email], fail_silently=False)
        return Response({"code": "IG001"}, status=200)
    except Exception:
        logger.exception("send_user_credentials_error")
        return Response({"code": "GEN002"}, status=500)

# Verify OTP and set password
@api_view(['POST'])
@permission_classes([AllowAny])
def verify_otp_and_set_password(request):
    """
    POST: { "username": "...", "otp": "123456", "new_password": "..." }
    """
    username = request.data.get("username")
    otp = request.data.get("otp")
    new_password = request.data.get("new_password")

    if not username or not otp or not new_password:
        return Response({"detail": "username_otp_new_password_required"}, status=400)

    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({"detail": "user_not_found"}, status=404)

    cache_key = f"pwd_otp:{user.username}"
    expected = cache.get(cache_key)
    if not expected or expected != otp:
        return Response({"detail": "invalid_or_expired_otp"}, status=400)

    # set new password
    user.set_password(new_password)
    user.save()
    cache.delete(cache_key)

    return Response({"code": "IP002"}, status=200)

# -------- Canonical messages endpoint (DB + DEFAULTS merged) --------
@api_view(["GET"])
@permission_classes([AllowAny])
def get_messages(request):
    try:
        user_error = list(UserError.objects.values("error_code", "error_message"))
        user_validation = list(UserValidation.objects.values("validation_code", "validation_message"))
        user_information = list(UserInformation.objects.values("information_code", "information_text"))
    except Exception:
        user_error, user_validation, user_information = [], [], []

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

# Username & email checks
@api_view(['GET'])
@permission_classes([AllowAny])
def check_username(request):
    username = request.query_params.get("username", "").strip()
    if not username:
        return Response({"detail": "username query param required"}, status=status.HTTP_400_BAD_REQUEST)
    exists = User.objects.filter(username__iexact=username).exists()
    return Response({"exists": exists}, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([AllowAny])
def check_email(request):
    email = request.query_params.get("email", "").strip()
    if not email:
        return Response({"detail": "email query param required"}, status=status.HTTP_400_BAD_REQUEST)
    exists = User.objects.filter(email__iexact=email).exists()
    return Response({"exists": exists}, status=status.HTTP_200_OK)

def get_effective_permissions(user):
    """
    Compute final permission list with following priority:
    1️⃣ UserOverride (allow/deny)
    2️⃣ Role permissions (allow/deny)
    3️⃣ Department permissions (allow)
    """
    final = {}
    # 1️⃣ User Overrides
    overrides = UserPermissionOverride.objects.filter(user=user)
    for o in overrides:
        final[o.permission.codename] = o.is_allowed

    # 2️⃣ Role Permissions
    if user.role_id:
        role_perms = RolePermission.objects.filter(role_id=user.role_id)
        for rp in role_perms:
            if rp.permission.codename not in final:
                final[rp.permission.codename] = rp.is_allowed

    # 3️⃣ Department Permissions
    if user.department_id:
        dept_perms = DepartmentPermission.objects.filter(department_id=user.department_id)
        for dp in dept_perms:
            if dp.permission.codename not in final:
                final[dp.permission.codename] = True   # department always “allow”

    return sorted([codename for codename, allowed in final.items() if allowed])
