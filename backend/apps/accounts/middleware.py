# =====================================================================
# 🔐 CUSTOM MIDDLEWARE FOR RATE LIMITING & SECURITY
# =====================================================================

import time
from django.http import JsonResponse
from django.core.cache import cache
from django.conf import settings


class RateLimitMiddleware:
    """
    🔐 Rate Limiting Middleware
    - Limits login attempts: 5/min per IP
    - Limits OTP send: 3/min per IP
    - Limits OTP verify: 5/min per IP
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Get client IP
        ip = self.get_client_ip(request)

        # Define rate limit rules
        limits = {
            "/api/auth/login-init/": (5, 60),         # 5 attempts per 60 seconds
            "/api/auth/login-verify-otp/": (5, 60),   # 5 attempts per 60 seconds
        }

        # Check rate limit
        for path, (max_requests, window_seconds) in limits.items():
            if request.path.startswith(path):
                cache_key = f"ratelimit:{ip}:{path}"
                attempts = cache.get(cache_key, 0)

                if attempts >= max_requests:
                    return JsonResponse(
                        {"code": "GEN003", "error": "Too many requests. Try again later."},
                        status=429
                    )

                # Increment counter
                cache.set(cache_key, attempts + 1, window_seconds)

        response = self.get_response(request)
        return response

    @staticmethod
    def get_client_ip(request):
        """Get the client's IP address"""
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip = x_forwarded_for.split(",")[0].strip()
        else:
            ip = request.META.get("REMOTE_ADDR", "unknown")
        return ip
