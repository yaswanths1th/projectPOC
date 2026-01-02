from rest_framework.viewsets import ModelViewSet
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import ValidationError

from apps.accounts.models import User, Tenant
from apps.accounts.serializers import TenantAdminCreateSerializer
from apps.accounts.permissions import IsSuperAdmin
from apps.subscriptions.services.usage_service import consume_resource


class TenantAdminViewSet(ModelViewSet):
    queryset = User.objects.filter(is_tenant_admin=True).order_by("-id")
    serializer_class = TenantAdminCreateSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def create(self, request, *args, **kwargs):
        tenant_id = request.data.get("tenant_id")

        if not tenant_id:
            return Response(
                {"detail": "tenant_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            tenant = Tenant.objects.get(id=tenant_id)

            # 🔒 ENFORCE USER LIMIT (SINGLE SOURCE OF TRUTH)
            consume_resource(
                tenant=tenant,
                resource_key="users",
                delta=1
            )

        except Tenant.DoesNotExist:
            return Response(
                {"detail": "Invalid tenant"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        except ValidationError as e:
            # 🔥 HARD LIMIT HIT (clean + safe)
            return Response(
                {
                    "code": e.detail.get("code", "USER_LIMIT_REACHED"),
                    "detail": e.detail.get(
                        "detail",
                        "User limit reached. Upgrade plan."
                    ),
                },
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )

        # ✅ Allowed → create tenant admin
        return super().create(request, *args, **kwargs)
