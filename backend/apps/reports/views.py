from django.contrib.auth import get_user_model
from django.db.models import Count
from django.utils.timezone import now, timedelta
from rest_framework.views import APIView
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

User = get_user_model()


class AdminUserGrowth(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        days = int(request.query_params.get("days", 30))
        since = now() - timedelta(days=days)

        data = (
            User.objects
            .filter(date_joined__gte=since)
            .extra(select={"day": "date(date_joined)"})
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )

        return Response([
            {"date": str(row["day"]), "count": row["count"]}
            for row in data
        ])


class AdminRecentUsers(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        days = int(request.query_params.get("days", 30))
        since = now() - timedelta(days=days)

        users = (
            User.objects
            .filter(date_joined__gte=since)
            .order_by("-date_joined")
        )

        return Response([
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "is_active": u.is_active,
                "joined": u.date_joined,
            }
            for u in users
        ])
