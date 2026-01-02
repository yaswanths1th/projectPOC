# backend/apps/accounts/views.py
from django.core.mail import send_mail
from django.utils import timezone
from django.contrib.auth import get_user_model

from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated 
from rest_framework.decorators import api_view, permission_classes
from rest_framework.views import APIView
from rest_framework.response import Response
from .models_permissions import get_effective_permissions
from rest_framework.generics import RetrieveUpdateAPIView

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

import logging

from .models import (
    User, Department, Role, Tenant,
    UserInvite,
    UserError, UserInformation, UserValidation
)
from .models_permissions import (
    Permission, DepartmentPermission, RolePermission, UserPermissionOverride
)

from .serializers import (
    RegisterSerializer, UserSerializer, DepartmentSerializer,
    RoleSerializer, ProfileSerializer,
    InviteCreateSerializer, InviteValidateSerializer, InviteAcceptSerializer,AdminUserCreateSerializer
)

from .permissions import IsRoleAdmin
from .constants import DEFAULT_MESSAGES

logger = logging.getLogger(__name__)
User = get_user_model()


# -------------------------------------------------------
# Profile endpoints
# -------------------------------------------------------

# -------------------------------------------------------
# Registration
# -------------------------------------------------------
@api_view(["POST"])
@permission_classes([AllowAny])
def register_user(request):
    """
    Regular registration endpoint. The RegisterSerializer handles
    invite_code and default tenant assignment.
    """
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response({"code": "IR001"}, status=201)
    return Response(serializer.errors, status=400)


# -------------------------------------------------------
# LOGIN (JWT)
# -------------------------------------------------------
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        try:
            data = super().validate(attrs)
        except Exception:
            return {"code": "EL001"}

        user = self.user
        permissions = get_effective_permissions(user)

        data.update({
            "id": user.id,
            "username": user.username,
            "email": user.email,

            "tenant_id": user.tenant_id,
            "tenant_slug": user.tenant.slug if user.tenant else None,
            "tenant_name": user.tenant.name if user.tenant else None,

            "department_id": user.department_id,
            "department_name": user.department.department_name if user.department else None,
            "role_id": user.role_id,
            "role_name": user.role.role_name if user.role else None,

            "permissions": permissions,

            # 👇 ADD THESE TWO LINES
            "is_superadmin": user.is_superadmin,
            "is_tenant_admin": user.is_tenant_admin,

            # 👇 Update is_admin so it's tenant-admin only
            "is_admin": user.is_superadmin or user.is_tenant_admin
        })

        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


# -------------------------------------------------------
# Profile (mirror of login response)
# -------------------------------------------------------
# -------------------------------------------------------
# Profile (mirror of login response)
# -------------------------------------------------------
class ProfileAPIView(RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        return self.request.user

    def get(self, request):
        user = request.user
        permissions = get_effective_permissions(user)

        data = UserSerializer(user).data
        data.update({
            "tenant_id": user.tenant_id,
            "tenant_slug": user.tenant.slug if user.tenant else None,
            "tenant_name": user.tenant.name if user.tenant else None,

            "role_id": user.role_id,
            "role_name": user.role.role_name if user.role else None,
            "department_id": user.department_id,
            "department_name": user.department.department_name if user.department else None,

            "permissions": permissions,

            # expose explicit flags so frontend can rely on them
            "is_superadmin": bool(getattr(user, "is_superadmin", False)),
            "is_tenant_admin": bool(getattr(user, "is_tenant_admin", False)),

            # keep backward-compatible is_admin, computed server-side
            "is_admin": user.is_superadmin or user.is_tenant_admin,
        })

        return Response(data)


# -------------------------------------------------------
# ADMIN — USERS (Tenant-aware)
# -------------------------------------------------------
class AdminUserListCreateAPIView(generics.ListCreateAPIView):
    permission_classes = [IsRoleAdmin]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return AdminUserCreateSerializer
        return UserSerializer

    def get_queryset(self):
        user = self.request.user

        if user.is_superadmin:
            return User.objects.all().order_by("-id")

        if user.is_tenant_admin:
            return User.objects.filter(
                tenant_id=user.tenant_id
            ).order_by("-id")

        return User.objects.filter(
            tenant_id=user.tenant_id,
            department_id=user.department_id
        ).order_by("-id")

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        user = request.user

        # protect tenant/department
        data.pop("department_id", None)
        data.pop("role_id", None)

        if user.is_superadmin:
            data["tenant"] = data.get("tenant")

        elif user.is_tenant_admin:
            data["tenant"] = user.tenant_id
            if not data.get("department"):
                data["department"] = Department.objects.filter(
                    tenant_id=user.tenant_id,
                    department_name="General"
                ).first().id
        else:
            data["tenant"] = user.tenant_id
            data["department"] = user.department_id

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        new_user = serializer.save()

        return Response(
            {
                "code": "IR001",
                "id": new_user.id,
                "warning": serializer.context.get("usage_warning", False),
            },
            status=status.HTTP_201_CREATED
        )



class AdminUserUpdateDeleteAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsRoleAdmin]

    def get_queryset(self):
        user = self.request.user

        if user.is_superadmin:
            return User.objects.all()

        if user.is_tenant_admin:
            return User.objects.filter(tenant_id=user.tenant_id)

        # Department admin → same department only
        return User.objects.filter(
            tenant_id=user.tenant_id,
            department_id=user.department_id
        )

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()

        # 🔒 Prevent deleting self
        if user.id == request.user.id:
            return Response(
                {"detail": "You cannot delete your own account"},
                status=400
            )

        # ✅ Soft delete
        if user.is_active:
            user.is_active = False
            user.save(update_fields=["is_active"])

            # ✅ Decrement tenant usage safely
            if user.tenant_id:
                decrement_users(user.tenant)

        return Response({"code": "ID001"}, status=200)

# -------------------------------------------------------
# Admin Stats
# -------------------------------------------------------
class AdminUserStatsAPIView(generics.GenericAPIView):
    permission_classes = [IsRoleAdmin]

    def get(self, request):
        user = request.user

        if user.is_superadmin:
            qs = User.objects.all()

        elif user.is_tenant_admin:
            qs = User.objects.filter(tenant_id=user.tenant_id)

        else:
            qs = User.objects.filter(
                tenant_id=user.tenant_id,
                department_id=user.department_id
            )

        return Response({
            "total_users": qs.count(),
            "active_users": qs.filter(is_active=True).count(),
            "hold_users": qs.filter(is_active=False).count(),
        }, status=200)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def superadmin_stats(request):
    user = request.user

    if not user.is_superadmin:
        return Response({"detail": "Forbidden"}, status=403)

    return Response({
        "total_tenants": Tenant.objects.count(),
        "active_tenants": Tenant.objects.filter(is_active=True).count(),
        "total_users": User.objects.count(),
        "active_users": User.objects.filter(is_active=True).count(),
        "tenant_admins": User.objects.filter(is_tenant_admin=True).count(),
    }, status=200)

# -------------------------------------------------------
# Departments (Tenant-Aware)
# -------------------------------------------------------
class DepartmentListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = DepartmentSerializer

    def get_queryset(self):
        user = self.request.user
        if user.is_superadmin:
            return Department.objects.all().order_by("department_name")
        return Department.objects.filter(tenant_id=user.tenant_id).order_by("department_name")

    def perform_create(self, serializer):
        user = self.request.user
        if user.is_superadmin:
            tenant_id = self.request.data.get("tenant")
            tenant = Tenant.objects.filter(id=tenant_id).first() if tenant_id else Tenant.objects.filter(slug="default").first()
        else:
            tenant = user.tenant
        serializer.save(tenant=tenant)



class DepartmentRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsRoleAdmin]


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def department_toggle_active(request, pk):
    try:
        dept = Department.objects.get(pk=pk)
        dept.is_active = not dept.is_active
        dept.save()
        return Response({"code": "IP001"}, status=200)
    except Department.DoesNotExist:
        return Response({"code": "GEN001"}, status=404)


# -------------------------------------------------------
# Roles (Tenant-Aware)
# -------------------------------------------------------
class RoleListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = RoleSerializer

    def get_permissions(self):
        if self.request.method == "GET":
            return [IsAuthenticated()]
        return [IsRoleAdmin()]

    def get_queryset(self):
        user = self.request.user

        if user.is_superadmin:
            return Role.objects.all().order_by("role_name")

        if user.is_tenant_admin:
            return Role.objects.filter(
                tenant_id=user.tenant_id
            ).order_by("role_name")

        # Department admin → roles in same department only (optional)
        return Role.objects.filter(
            tenant_id=user.tenant_id,
            department_id=user.department_id
        ).order_by("role_name")


class RoleRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsRoleAdmin]


@api_view(["POST"])
@permission_classes([IsAuthenticated])

def role_toggle_active(request, pk):
    try:
        role = Role.objects.get(pk=pk)
        role.is_active = not role.is_active
        role.save()
        return Response({"code": "IP001"}, status=200)
    except Role.DoesNotExist:
        return Response({"code": "GEN001"}, status=404)


# -------------------------------------------------------
# User toggle active (keeps URL stable)
# -------------------------------------------------------
@api_view(["POST"])
@permission_classes([IsRoleAdmin])

def user_toggle_active(request, pk):
    try:
        user_obj = User.objects.get(pk=pk)
        user_obj.is_active = not user_obj.is_active
        user_obj.save()
        return Response({"code": "IP001"}, status=200)
    except User.DoesNotExist:
        return Response({"code": "GEN001"}, status=404)


# -------------------------------------------------------
# Email sending helper
# -------------------------------------------------------
@api_view(["POST"])
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
        send_mail("Your Login Credentials", message, None, [email], fail_silently=False)
        return Response({"code": "IG001"}, status=200)
    except Exception:
        return Response({"code": "GEN002"}, status=500)


# -------------------------------------------------------
# Canonical messages endpoint (DB + defaults)
# -------------------------------------------------------
@api_view(["GET"])
@permission_classes([AllowAny])
def get_messages(request):
    try:
        user_error = list(UserError.objects.values("error_code", "error_message"))
        user_validation = list(UserValidation.objects.values("validation_code", "validation_message"))
        user_information = list(UserInformation.objects.values("information_code", "information_text"))
    except Exception:
        user_error, user_validation, user_information = [], [], []

    # Merge with defaults
    for code, msg in DEFAULT_MESSAGES["ERRORS"].items():
        if not any(e["error_code"] == code for e in user_error):
            user_error.append({"error_code": code, "error_message": msg})

    for code, msg in DEFAULT_MESSAGES["VALIDATIONS"].items():
        if not any(v["validation_code"] == code for v in user_validation):
            user_validation.append({"validation_code": code, "validation_message": msg})

    for code, msg in DEFAULT_MESSAGES["INFORMATION"].items():
        if not any(i["information_code"] == code for i in user_information):
            user_information.append({"information_code": code, "information_text": msg})

    return Response({
        "user_error": user_error,
        "user_validation": user_validation,
        "user_information": user_information
    }, status=200)


# -------------------------------------------------------
# Invite endpoints
# -------------------------------------------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_invite(request):
    user = request.user
    serializer = InviteCreateSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    if not (user.is_superadmin or user.is_tenant_admin):
        return Response({"detail": "Not allowed"}, status=403)

    email = serializer.validated_data["email"]
    days = serializer.validated_data.get("expires_days", 3)

    if user.is_superadmin:
        tenant_id = request.data.get("tenant")
        tenant = Tenant.objects.filter(id=tenant_id).first()
        if not tenant:
            return Response({"detail": "Tenant required"}, status=400)
    else:
        tenant = user.tenant

    invite = UserInvite.create_invite(email=email, tenant=tenant, invited_by=user, days_valid=days)
    link = f"{request.scheme}://{request.get_host()}/invite/{invite.code}"

    # optionally send email
    try:
        send_mail(
            subject=f"You're invited to {tenant.name}",
            message=f"Join {tenant.name}: {link}",
            from_email=None,
            recipient_list=[email],
            fail_silently=True,
        )
    except Exception:
        pass

    return Response({"code": "INV_CREATED", "invite_link": link}, status=201)


@api_view(["GET"])
@permission_classes([AllowAny])
def validate_invite(request, code):
    try:
        invite = UserInvite.objects.get(code=code, used=False)
    except UserInvite.DoesNotExist:
        return Response({"valid": False, "reason": "invalid"}, status=404)

    if invite.expires_at < timezone.now():
        return Response({"valid": False, "reason": "expired"}, status=410)

    return Response({
        "valid": True,
        "email": invite.email,
        "tenant": {
            "id": invite.tenant.id,
            "name": invite.tenant.name,
            "slug": invite.tenant.slug
        }
    }, status=200)


@api_view(["POST"])
@permission_classes([AllowAny])
def accept_invite(request):
    """
    Accept an invite: expects { code, password, first_name?, last_name? }.
    Uses InviteAcceptSerializer which creates the user (serializer.create).
    """
    serializer = InviteAcceptSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    user = serializer.create(serializer.validated_data)
    return Response({"code": "INV_ACCEPTED", "id": user.id}, status=201)


# -------------------------------------------------------
# Availability checks (missing previously) — required by URLs/frontend
# -------------------------------------------------------
@api_view(["GET"])
@permission_classes([AllowAny])
def check_username(request):
    username = request.query_params.get("username", "").strip()
    if not username:
        return Response({"detail": "username query param required"}, status=status.HTTP_400_BAD_REQUEST)
    exists = User.objects.filter(username__iexact=username).exists()
    return Response({"exists": exists}, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([AllowAny])
def check_email(request):
    email = request.query_params.get("email", "").strip()
    if not email:
        return Response({"detail": "email query param required"}, status=status.HTTP_400_BAD_REQUEST)
    exists = User.objects.filter(email__iexact=email).exists()
    return Response({"exists": exists}, status=status.HTTP_200_OK)


# -------------------------------------------------------
# Permissions calculation
# -------------------------------------------------------
def get_effective_permissions(user):
    final = {}

    # User overrides
    for o in UserPermissionOverride.objects.filter(user=user):
        final[o.permission.codename] = o.is_allowed

    # Role permissions
    if user.role_id:
        for rp in RolePermission.objects.filter(role_id=user.role_id):
            if rp.permission.codename not in final:
                final[rp.permission.codename] = rp.is_allowed

    # Department permissions (always allow)
    if user.department_id:
        for dp in DepartmentPermission.objects.filter(department_id=user.department_id):
            if dp.permission.codename not in final:
                final[dp.permission.codename] = True

    return sorted([code for code, allowed in final.items() if allowed])

# -------------------------------------------------------
# SUPERADMIN — Tenant CRUD
# -------------------------------------------------------
from rest_framework import viewsets, permissions
from .serializers import TenantSerializer

class TenantViewSet(viewsets.ModelViewSet):
    queryset = Tenant.objects.all().order_by("-id")
    serializer_class = TenantSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        """Superadmin ONLY allowed to manage tenants."""
        if not self.request.user.is_superadmin:
            return [permissions.IsAdminUser()]  # will return 403
        return [IsAuthenticated()]

