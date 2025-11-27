# backend/apps/accounts/authentication.py
from rest_framework_simplejwt.authentication import JWTAuthentication

class CookieJWTAuthentication(JWTAuthentication):
    """
    Read access token from HttpOnly cookie 'access_token' if Authorization header absent.
    """
    def get_header(self, request):
        header = super().get_header(request)
        if header:
            return header
        access = request.COOKIES.get("access_token")
        if not access:
            return None
        return f"Bearer {access}".encode()
