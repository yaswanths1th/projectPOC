from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from apps.subscriptions.models import SubscriptionPlan, UserSubscription, get_features_for_plan
from apps.subscriptions.serializers import SubscriptionPlanSerializer, UserSubscriptionSerializer


class CurrentSubscriptionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        sub = (
            UserSubscription.objects
            .select_related("plan")
            .filter(user=user, active=True)
            .order_by("-started_at")
            .first()
        )

        if sub:
            return Response(
                UserSubscriptionSerializer(sub).data,
                status=status.HTTP_200_OK
            )

        free_plan = SubscriptionPlan.objects.filter(slug="free", is_active=True).first()
        features = get_features_for_plan("free")

        return Response({
            "id": None,
            "slug": "free",
            "name": "Free",
            "status": "free",
            "active": True,
            "features": features,
        })

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ai_free_chat(request):
    return Response(
        {"detail": "AI chat placeholder"},
        status=200
    )
