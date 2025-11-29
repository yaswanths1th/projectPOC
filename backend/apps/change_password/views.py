from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from django.contrib.auth.password_validation import validate_password    # 🔐 SECURITY FIX: Strong password check
from rest_framework.exceptions import ValidationError                    # 🔐 SECURITY FIX: Proper error handling

from .serializers import ChangePasswordSerializer

User = get_user_model()


# =====================================================================
# 🔐 SECURE CHANGE PASSWORD API
# =====================================================================
@api_view(['POST'])
@permission_classes([IsAuthenticated])   # User must be logged in
def change_password(request):
    """
    POST /api/change-password/
    {
        "old_password": "...",
        "new_password": "...",
        "confirm_password": "..."
    }
    """

    # ❌ OLD:
    # serializer = ChangePasswordSerializer(...)

    # 🔐 SECURITY FIX:
    # Always pass request in context for user reference
    serializer = ChangePasswordSerializer(
        data=request.data,
        context={'request': request}
    )

    if serializer.is_valid():

        user = request.user
        old_password = request.data.get("old_password")
        new_password = request.data.get("new_password")
        confirm_password = request.data.get("confirm_password")

        # ------------------------------------------------------------
        # 🔐 SECURITY FIX 1:
        # Verify OLD password matches
        # ------------------------------------------------------------
        if not user.check_password(old_password):
            return Response(
                {"code": "CP001", "detail": "Old password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ------------------------------------------------------------
        # 🔐 SECURITY FIX 2:
        # New password must not equal old password
        # ------------------------------------------------------------
        if old_password == new_password:
            return Response(
                {"code": "CP002", "detail": "New password cannot be same as old password."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ------------------------------------------------------------
        # 🔐 SECURITY FIX 3:
        # Confirm match
        # ------------------------------------------------------------
        if new_password != confirm_password:
            return Response(
                {"code": "CP003", "detail": "New password & confirm password do not match."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ------------------------------------------------------------
        # 🔐 SECURITY FIX 4:
        # Must validate new password strength
        # ------------------------------------------------------------
        try:
            validate_password(new_password, user=user)
        except ValidationError as e:
            return Response(
                {"code": "CP004", "detail": list(e.messages)},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ------------------------------------------------------------
        # 🔐 SECURITY FIX 5:
        # Update password securely
        # ------------------------------------------------------------
        user.set_password(new_password)
        user.save()

        # ------------------------------------------------------------
        # 🔐 SECURITY FIX 6:
        # Log out all sessions except the current one
        # (PREVENT token reuse from old devices)
        # ------------------------------------------------------------
        request.auth.delete() if request.auth else None

        return Response(
            {"detail": "Password changed successfully."},
            status=status.HTTP_200_OK
        )

    # ❌ OLD:
    # return 400 directly

    # 🔐 SECURITY FIX:
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
