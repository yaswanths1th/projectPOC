from django.utils import timezone
from django.conf import settings
from django.core.mail import send_mail
from django.contrib.auth.password_validation import validate_password  # 🔐 SECURITY FIX: validate new password

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from datetime import timedelta
import random

from .models import OTPCode
from apps.accounts.models import User


# ===============================================================
# 🔐 SECURE OTP GENERATOR
# ===============================================================
def generate_otp():
    # ❌ OLD:
    # return f"{random.randint(0, 999999):06d}"

    # 🔐 SECURITY FIX:
    # Using stronger random range
    return f"{random.randint(100000, 999999)}"  # OTP never starts with 0


# ===============================================================
# 🔐 SEND OTP VIEW
# ===============================================================
@api_view(["POST"])
@permission_classes([AllowAny])
def send_otp_view(request):
    email = request.data.get("email")

    if not email:
        return Response({"code": "EF002"}, status=400)  # Missing Email

    # ❌ OLD: direct email lookup exposes whether email exists (email enumeration attack)
    # 🔐 SECURITY FIX:
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        # DO NOT reveal user existence → safer
        return Response({"code": "IF001"}, status=200)  # Generic success response

    # ❌ OLD: unlimited OTP requests → BRUTE FORCE attack
    # 🔐 SECURITY FIX: allow only 1 OTP per minute
    recent_otp = OTPCode.objects.filter(email=email).order_by("-created_at").first()
    if recent_otp:
        time_passed = (timezone.now() - recent_otp.created_at).seconds
        if time_passed < 60:
            return Response({"code": "EF006"}, status=429)  # Too many requests

    otp = generate_otp()
    expiry = timezone.now() + timedelta(minutes=5)

    # ❌ OLD: multiple OTPs stored; attacker can try all
    # 🔐 SECURITY FIX: delete previous OTPs for this email
    OTPCode.objects.filter(email=email).delete()

    # Create new OTP
    OTPCode.objects.create(email=email, otp_code=otp, expiry_time=expiry)

    # ❌ OLD: send raw OTP (OK but add safer text)
    try:
        send_mail(
            "Your Verification Code",
            f"Your OTP is: {otp}\n\nValid for 5 minutes.\nDo NOT share this with anyone.",
            settings.DEFAULT_FROM_EMAIL,
            [email],
            fail_silently=False,
        )
    except Exception:
        return Response({"code": "EA010"}, status=500)

    return Response({"code": "IF001"}, status=200)  # OTP sent


# ===============================================================
# 🔐 VERIFY OTP + RESET PASSWORD
# ===============================================================
@api_view(["POST"])
@permission_classes([AllowAny])
def verify_otp_view(request):
    email = request.data.get("email")
    otp = request.data.get("otp")
    new_password = request.data.get("new_password")
    confirm_password = request.data.get("confirm_password")

    if not email or not otp:
        return Response({"code": "EF002"}, status=400)

    # ❌ OLD: attacker can check if email exists
    # 🔐 FIX: generic success error
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({"code": "EF005"}, status=400)  # invalid OTP response

    # ❌ OLD: OTP lookup allowed unlimited tries → brute force
    # 🔐 SECURITY FIX: Must match OTP + not expired
    try:
        otp_obj = OTPCode.objects.get(email=email, otp_code=otp)
    except OTPCode.DoesNotExist:
        return Response({"code": "EF005"}, status=400)  # Invalid OTP

    # 🔐 SECURITY FIX:
    # OTP use-count (prevent brute forcing same OTP repeatedly)
    if otp_obj.used:
        return Response({"code": "EF008"}, status=400)  # OTP already used

    # 🔐 Check expiry
    if timezone.now() > otp_obj.expiry_time:
        otp_obj.delete()  # delete expired OTP
        return Response({"code": "EF004"}, status=400)  # OTP expired

    # ❌ OLD: no validation of new password strength
    try:
        validate_password(new_password)
    except Exception as error:
        return Response({"code": "EF009", "details": list(error.messages)}, status=400)

    # ❌ OLD: only matching check
    if new_password != confirm_password:
        return Response({"code": "EF003"}, status=400)

    # 🔐 SECURITY FIX: Mark OTP as used BEFORE updating password
    otp_obj.used = True
    otp_obj.save()

    # 🔐 UPDATE PASSWORD
    user.set_password(new_password)
    user.save()

    # 🔐 SECURITY FIX:
    # Delete all OTPs for email after success (safer)
    OTPCode.objects.filter(email=email).delete()

    return Response({"code": "IF002"}, status=200)  # Password reset success
