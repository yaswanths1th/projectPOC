from rest_framework_simplejwt.authentication import JWTAuthentication

class CookieJWTAuthentication(JWTAuthentication):
    """
    Read access token from HttpOnly cookie 'access_token'
    and convert it into a valid Authorization header.
    """
    def get_header(self, request):
        header = super().get_header(request)
        if header:
            return header

        access = request.COOKIES.get("access_token")
        if access:
            return f"Bearer {access}".encode("utf-8")

        return None

    def authenticate(self, request):
        header = self.get_header(request)
        if header is None:
            return None

        return super().authenticate(request)
