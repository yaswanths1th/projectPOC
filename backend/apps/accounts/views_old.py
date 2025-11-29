# =====================================================================
# FULLY UPDATED views.py (PART 1)
# =====================================================================

from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

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
# EFFECTIVE PERMISSIONS MERGE LOGIC
# =====================================================================
def get_effective_permissions(user):
    final = {}

    # User overrides
    overrides = UserPermissionOverride.objects.filter(user=user)
    for o in overrides:
        final[o.permission.codename] = o.is_allowed

    # Role permissions
    if user.role_id:
        role_perms = RolePermission.objects.filter(role_id=user.role_id)
        for rp in role_perms:
            if rp.permission.codename not in final:
                final[rp.permission.codename] = rp.is_allowed

    # Department permissions
    if user.department_id:
        dept_perms = DepartmentPermission.objects.filter(department_id=user.department_id)
        for dp in dept_perms:
            if dp.permission.codename not in final:
                final[dp.permission.codename] = True

    return sorted([code for code, allowed in final.items() if allowed])


# =====================================================================
# STEP 1 — LOGIN INIT (USERNAME + PASSWORD)
# =====================================================================
@api_view(['POST'])
@permission_classes([AllowAny])
def login_init(request):
    username = request.data.get("username")
    password = request.data.get("password")

    if not username or not password:
        return Response({"code": "EV001"}, status=400)

    # Validate user
    user = User.objects.filter(username__iexact=username).first()
    if not user or not user.check_password(password):
        return Response({"code": "EL001"}, status=401)

    if not user.is_active:
        return Response({"code": "EL002"}, status=403)

    # Generate OTP
    otp_value = str(random.randint(100000, 999999))

    otp_entry = LoginOTP.objects.create(
        user=user,
        otp=otp_value
    )

    # Send OTP email
    try:
        if user.email:
            send_mail(
                subject="Your Login OTP",
                message=f"Your OTP is {otp_value}. It expires in 5 minutes.",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
    except Exception as e:
        logger.error("OTP Email failed for %s: %s", user.username, e)

    # Debug mode prints OTP
    if settings.DEBUG:
        print(f"🔐 DEBUG OTP for {user.username}: {otp_value}")

    return Response({
        "otp_required": True,
        "session_id": str(otp_entry.session_id),
    }, status=200)


# =====================================================================
# STEP 2 — VERIFY OTP & ISSUE JWT
# =====================================================================
@api_view(['POST'])
@permission_classes([AllowAny])
def login_verify_otp(request):
    session_id = request.data.get("session_id")
    otp_input = request.data.get("otp")

    if not session_id or not otp_input:
        return Response({"code": "EV002"}, status=400)

    otp_entry = LoginOTP.objects.filter(session_id=session_id).first()
    if not otp_entry:
        return Response({"code": "EL003"}, status=401)

    # Expired?
    if otp_entry.is_expired:
        otp_entry.delete()
        return Response({"code": "EL004"}, status=401)

    # Too many failed attempts?
    if otp_entry.failed_attempts >= 3:
        otp_entry.delete()
        return Response({"code": "EL005"}, status=403)

    # Incorrect OTP
    if otp_entry.otp != otp_input:
        otp_entry.failed_attempts += 1
        otp_entry.save()
        return Response({"code": "EL003"}, status=401)

    # OTP valid → Grant JWT tokens
    user = otp_entry.user
    refresh = RefreshToken.for_user(user)
    otp_entry.delete()

    permissions = get_effective_permissions(user)

    return Response({
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role_id": user.role_id,
        "role_name": user.role.role_name if user.role else None,
        "permissions": permissions,
        "is_admin": user.is_staff or user.is_superuser,
        "code": "IL001",
    }, status=200)

# =====================================================================
# PART 2 — JWT LOGIN (Legacy) + REGISTER + PROFILE + CHECK EMAIL/USERNAME
# =====================================================================


# =====================================================================
# LEGACY JWT LOGIN (still used by mobile apps or admin tools)
# =====================================================================
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        try:
            data = super().validate(attrs)
        except Exception:
            raise AuthenticationFailed({"code": "EL001"})

        user = self.user
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
# REGISTER USER
# =====================================================================
@api_view(['POST'])
@permission_classes([AllowAny])
def register_user(request):
    serializer = RegisterSerializer(data=request.data)

    if serializer.is_valid():
        serializer.save()
        return Response({"code": "IR001"}, status=201)

    return Response(serializer.errors, status=400)



# =====================================================================
# PROFILE VIEW / UPDATE
# =====================================================================
class ProfileAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        data = UserSerializer(user).data

        data.update({
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
            "is_admin": user.is_staff or user.is_superuser,
        })

        return Response(data, status=200)

    def put(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)

        if serializer.is_valid():
            serializer.save()
            return Response({"code": "IP001"}, status=200)

        return Response(serializer.errors, status=400)



# =====================================================================
# CHECK USERNAME (AJAX)
# =====================================================================
@api_view(['GET'])
@permission_classes([AllowAny])
def check_username(request):
    username = request.query_params.get("username", "").strip()

    if not username:
        return Response({"detail": "username query param required"}, status=400)

    exists = User.objects.filter(username__iexact=username).exists()

    return Response({"exists": exists}, status=200)



# =====================================================================
# CHECK EMAIL (AJAX)
# =====================================================================
@api_view(['GET'])
@permission_classes([AllowAny])
def check_email(request):
    email = request.query_params.get("email", "").strip()

    if not email:
        return Response({"detail": "email query param required"}, status=400)

    exists = User.objects.filter(email__iexact=email).exists()

    return Response({"exists": exists}, status=200)

# =====================================================================
# PART 3 — ADMIN USER MANAGEMENT (CRUD + Stats)
# =====================================================================


# =====================================================================
# ADMIN — LIST + CREATE USERS
# =====================================================================
class AdminUserListCreateAPIView(generics.ListCreateAPIView):
    queryset = User.objects.all().order_by("-id")
    serializer_class = UserSerializer
    permission_classes = [IsRoleAdmin]

    def create(self, request, *args, **kwargs):
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

        # Check password
        password = request.data.get("password")
        if not password:
            return Response({"password": "Password required"}, status=400)

        try:
            validate_password(password)
        except Exception as e:
            return Response({"password": str(e)}, status=400)

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)

        user = serializer.save()
        user.set_password(password)
        user.save()

        return Response({"code": "IR001", "id": user.id}, status=201)



# =====================================================================
# ADMIN — UPDATE + DELETE A USER
# =====================================================================
class AdminUserUpdateDeleteAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsRoleAdmin]

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        user.delete()
        return Response({"code": "ID001"}, status=200)



# =====================================================================
# ADMIN — TOGGLE USER ACTIVE/INACTIVE
# =====================================================================
@api_view(["POST"])
@permission_classes([IsRoleAdmin])
def user_toggle_active(request, pk):
    try:
        user = User.objects.get(pk=pk)
        user.is_active = not user.is_active
        user.save()
        return Response({"code": "IP001"}, status=200)

    except User.DoesNotExist:
        return Response({"code": "GEN001"}, status=404)



# =====================================================================
# ADMIN — BASIC STATS (Total users / active / inactive)
# =====================================================================
class AdminUserStatsAPIView(generics.GenericAPIView):
    permission_classes = [IsRoleAdmin]

    def get(self, request):
        return Response({
            "total_users": User.objects.count(),
            "active_users": User.objects.filter(is_active=True).count(),
            "hold_users": User.objects.filter(is_active=False).count(),
        }, status=200)
 
 # =====================================================================
# PART 4 — DEPARTMENTS • ROLES • MESSAGES • EMAIL SEND
# =====================================================================


# =====================================================================
# DEPARTMENTS — LIST + CREATE
# =====================================================================
class DepartmentListCreateAPIView(generics.ListCreateAPIView):
    queryset = Department.objects.all().order_by("department_name")
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        # GET is public
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsRoleAdmin()]


# =====================================================================
# DEPARTMENTS — RETRIEVE / UPDATE / DELETE
# =====================================================================
class DepartmentRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsRoleAdmin]


# =====================================================================
# DEPARTMENT — TOGGLE ACTIVE/INACTIVE
# =====================================================================
@api_view(["POST"])
@permission_classes([IsRoleAdmin])
def department_toggle_active(request, pk):
    try:
        dept = Department.objects.get(pk=pk)
        dept.is_active = not dept.is_active
        dept.save()
        return Response({"code": "IP001"}, status=200)

    except Department.DoesNotExist:
        return Response({"code": "GEN001"}, status=404)



# =====================================================================
# ROLES — LIST + CREATE
# =====================================================================
class RoleListCreateAPIView(generics.ListCreateAPIView):
    queryset = Role.objects.all().order_by("role_name")
    serializer_class = RoleSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [AllowAny()]
        return [IsRoleAdmin()]


# =====================================================================
# ROLES — RETRIEVE / UPDATE / DELETE
# =====================================================================
class RoleRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsRoleAdmin]


# =====================================================================
# ROLE — TOGGLE ACTIVE
# =====================================================================
@api_view(["POST"])
@permission_classes([IsRoleAdmin])
def role_toggle_active(request, pk):
    try:
        role = Role.objects.get(pk=pk)
        role.is_active = not role.is_active
        role.save()
        return Response({"code": "IP001"}, status=200)

    except Role.DoesNotExist:
        return Response({"code": "GEN001"}, status=404)



# =====================================================================
# SEND USER CREDENTIALS VIA EMAIL
# =====================================================================
@api_view(['POST'])
@permission_classes([IsRoleAdmin])
def send_user_credentials(request):
    email = request.data.get("email")
    username = request.data.get("username")
    password = request.data.get("password")

    if not email or not username:
        return Response({"email": "VA002"}, status=400)

    message = f"""
Hello {username},

Your account has been created.

Username: {username}
Password: {password}

Login: http://localhost:5173/login
"""

    try:
        send_mail(
            "Your Login Credentials",
            message,
            settings.DEFAULT_FROM_EMAIL,
            [email],
            fail_silently=False
        )
        return Response({"code": "IG001"}, status=200)

    except Exception as e:
        logger.error("Email send error: %s", e)
        return Response({"code": "GEN002"}, status=500)



# =====================================================================
# MERGED SYSTEM MESSAGES API
# =====================================================================
@api_view(["GET"])
@permission_classes([AllowAny])
def get_messages(request):
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
