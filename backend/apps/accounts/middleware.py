# apps/accounts/middleware.py

from django.utils.deprecation import MiddlewareMixin
from apps.accounts.models import Tenant

class TenantMiddleware(MiddlewareMixin):
    """
    Auto-attach tenant to request.user (if logged in)
    and restrict all queries by tenant.
    """

    def process_request(self, request):
        user = getattr(request, "user", None)

        # User not logged in → no tenant
        if not user or not user.is_authenticated:
            request.tenant = None
            return

        # Attach tenant object to request
        request.tenant = user.tenant
