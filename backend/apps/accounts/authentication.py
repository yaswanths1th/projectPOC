# =====================================================================
# 🔐 CUSTOM JWT AUTHENTICATION (READ FROM COOKIES)
# =====================================================================
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed, InvalidToken
from rest_framework.exceptions import AuthenticationFailed as DRFAuthenticationFailed


class CookieJWTAuthentication(JWTAuthentication):
    """
    Custom JWT authentication that reads tokens from cookies instead of headers.
    Falls back to Authorization header if cookie not found.
    """

    def get_validated_token(self, raw_token):
        """Validate the token (inherited from JWTAuthentication)"""
        try:
            return super().get_validated_token(raw_token)
        except InvalidToken:
            raise AuthenticationFailed("Invalid token")

    def authenticate(self, request):
        """
        Read JWT from:
        1. Cookie: access_token (primary)
        2. Authorization header: Bearer <token> (fallback)
        """
        # Try to get token from cookie first
        raw_token = request.COOKIES.get("access_token", None)

        # Fallback to Authorization header
        if not raw_token:
            auth = request.META.get("HTTP_AUTHORIZATION", "").split()
            if len(auth) == 2 and auth[0].lower() == "bearer":
                raw_token = auth[1]

        # No token found
        if not raw_token:
            return None

        # Validate and return user
        try:
            validated_token = self.get_validated_token(raw_token)
            user = self.get_user(validated_token)
            return (user, validated_token)
        except Exception as exc:
            raise DRFAuthenticationFailed(str(exc))
