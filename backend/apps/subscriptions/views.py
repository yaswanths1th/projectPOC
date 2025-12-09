# backend/apps/subscriptions/views.py

import os
import logging
import requests

from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.db import transaction

from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny

from .models import SubscriptionPlan, UserSubscription, get_features_for_plan
from .serializers import SubscriptionPlanSerializer, UserSubscriptionSerializer

logger = logging.getLogger(__name__)


# ==========================
# Plans list (for /api/plans/)
# ==========================
class PlanListAPIView(generics.ListAPIView):
    """
    GET /api/plans/
    Returns all active plans with feature flags (from subscription_feature_matrix).
    """
    queryset = SubscriptionPlan.objects.filter(is_active=True).order_by("price_cents")
    serializer_class = SubscriptionPlanSerializer
    permission_classes = [permissions.AllowAny]


# =============================================
# Current subscription (for /api/subscription/)
# =============================================
class CurrentSubscriptionView(APIView):
    """
    GET /api/subscription/
    Returns the user's active subscription with features, or a "free" fallback.
    """

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
            serializer = UserSubscriptionSerializer(sub)
            return Response(serializer.data, status=status.HTTP_200_OK)

        # No active row → fallback to free
        free_plan = SubscriptionPlan.objects.filter(slug="free", is_active=True).first()
        features = get_features_for_plan("free")

        if free_plan:
            data = {
                "id": None,
                "plan": SubscriptionPlanSerializer(free_plan).data,
                "started_at": None,
                "expires_at": None,
                "active": True,
                "status": "free",
                "payment_provider": None,
                "payment_reference": None,
                "can_use_ai": bool(features.get("can_use_ai", False)),
                "can_edit_profile": bool(features.get("can_edit_profile", True)),
                "can_change_password": bool(features.get("can_change_password", True)),
                "max_projects": features.get("max_projects"),
            }
            return Response(data, status=status.HTTP_200_OK)

        # No free plan row in DB → hard-coded ultimate fallback
        data = {
            "id": None,
            "plan": {
                "id": None,
                "slug": "free",
                "name": "Free",
                "description": "Free fallback plan",
                "price_cents": 0,
                "currency": "INR",
                "billing_cycle": "monthly",
                "interval": "monthly",
                "is_active": True,
            },
            "started_at": None,
            "expires_at": None,
            "active": True,
            "status": "free",
            "payment_provider": None,
            "payment_reference": None,
            "can_use_ai": False,
            "can_edit_profile": True,
            "can_change_password": True,
            "max_projects": 1,
        }
        return Response(data, status=status.HTTP_200_OK)


# ======================================
# Subscribe endpoint (for /api/subscribe/)
# ======================================
class SubscribeView(APIView):
    """
    POST /api/subscribe/
    Body: { "plan_slug": "pro" }

    Steps:
    1. Mark existing active subscriptions for this user as expired
    2. Create a new active subscription
    3. Return the new subscription JSON
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        plan_slug = request.data.get("plan_slug")

        if not plan_slug:
            return Response(
                {"detail": "plan_slug is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        plan = get_object_or_404(
            SubscriptionPlan,
            slug=plan_slug,
            is_active=True,
        )

        now = timezone.now()

        with transaction.atomic():
            # 1) expire existing active subs
            UserSubscription.objects.filter(user=user, active=True).update(
                active=False,
                status="expired",
                expires_at=now,
            )

            # 2) create new active subscription
            new_sub = UserSubscription.objects.create(
                user=user,
                plan=plan,
                started_at=now,
                status="active",
                active=True,
                payment_provider=request.data.get("payment_provider"),
                payment_reference=request.data.get("payment_reference"),
            )

        print(
            f"[SubscribeView ORM] user={user.id}, plan={plan.slug}, new_id={new_sub.id}, active={new_sub.active}"
        )

        serializer = UserSubscriptionSerializer(new_sub)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


# ==========================================
# Helper: check AI access from feature matrix
# ==========================================
def user_has_ai_access(user):
    """
    Uses UserSubscription + subscription_feature_matrix (via get_features_for_plan)
    to determine if this user can use AI.
    """
    sub = (
        UserSubscription.objects
        .select_related("plan")
        .filter(user=user, active=True)
        .order_by("-started_at")
        .first()
    )

    if sub and sub.plan:
        slug = (sub.plan.slug or "").lower()
    else:
        slug = "free"

    features = get_features_for_plan(slug)
    can_use_ai = bool(features.get("can_use_ai", False))
    return can_use_ai, slug


# ==========================
# AI proxy (Gemini) endpoint
# ==========================
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ai_free_chat(request):
    """
    POST /api/ai/free-chat/
    Body: { "prompt": "..." }

    - Checks subscription via user_has_ai_access (feature matrix)
    - Calls Gemini API and returns text reply
    """
    import json

    user = request.user
    prompt = request.data.get("prompt") or ""
    if not isinstance(prompt, str) or prompt.strip() == "":
        return Response(
            {"detail": "prompt required"}, status=status.HTTP_400_BAD_REQUEST
        )

    # 🔒 Subscription gating via feature matrix
    allowed, plan_slug = user_has_ai_access(user)
    if not allowed:
        logger.info(
            "AI access denied for user %s on plan '%s'", user.id, plan_slug or "none"
        )
        return Response(
            {
                "detail": "Your current subscription does not include AI access.",
                "code": "NO_AI_ACCESS",
                "plan": plan_slug or "none",
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    if not GEMINI_API_KEY:
        logger.error("GEMINI_API_KEY missing from environment")
        return Response(
            {"detail": "GEMINI_API_KEY missing from server"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    gf_model = os.getenv("GEMINI_MODEL", GEMINI_MODEL)
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{gf_model}:generateContent"
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
    }

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "candidateCount": 1,
            "temperature": 0.7,
            "maxOutputTokens": 2048,
        },
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=30)
    except requests.exceptions.Timeout:
        logger.exception("Timeout when calling Gemini API")
        return Response(
            {"detail": "Gemini request timed out"},
            status=status.HTTP_504_GATEWAY_TIMEOUT,
        )
    except requests.exceptions.RequestException as exc:
        logger.exception("Network error calling Gemini API: %s", exc)
        return Response(
            {"detail": "Gemini request failed", "error": str(exc)},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    if resp.status_code == 429:
        try:
            j = resp.json()
            retry = None
            for d in j.get("error", {}).get("details", []):
                if d.get("@type", "").endswith("RetryInfo"):
                    rd = d.get("retryDelay")
                    if isinstance(rd, str) and rd.endswith("s"):
                        retry = int(float(rd[:-1]))
                    elif isinstance(rd, dict) and "seconds" in rd:
                        retry = int(rd.get("seconds", 0))
                    break
        except Exception:
            retry = None
        body = {"detail": "Rate limit reached", "provider_body": resp.text}
        r = Response(body, status=429)
        if retry:
            r["Retry-After"] = str(retry)
        return r

    if resp.status_code < 200 or resp.status_code >= 300:
        logger.warning(
            "Gemini API returned non-2xx: %s - body: %s",
            resp.status_code,
            resp.text[:2000],
        )
        return Response(
            {
                "detail": "Gemini API error",
                "status": resp.status_code,
                "body": resp.text,
            },
            status=status.HTTP_502_BAD_GATEWAY,
        )

    try:
        data = resp.json()
    except Exception:
        logger.exception("Failed to parse JSON from Gemini response")
        return Response(
            {"detail": "Invalid response from Gemini API", "body": resp.text},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    reply = None
    try:
        candidates = data.get("candidates") if isinstance(data, dict) else None
        if candidates and isinstance(candidates, list) and len(candidates) > 0:
            first = candidates[0]
            content = first.get("content") or {}
            parts = content.get("parts") or []
            if parts and isinstance(parts[0], dict) and "text" in parts[0]:
                reply = parts[0]["text"]
            if not reply:
                if isinstance(content, dict) and "text" in content:
                    reply = content.get("text")
                elif isinstance(first, dict) and "text" in first:
                    reply = first.get("text")

        if not reply and isinstance(data, dict) and "output" in data:
            out0 = data["output"][0] if data.get("output") else None
            if isinstance(out0, dict):
                cparts = out0.get("content", [])
                if (
                    cparts
                    and isinstance(cparts[0], dict)
                    and "text" in cparts[0]
                ):
                    reply = cparts[0]["text"]

        if not reply and isinstance(data, dict) and "response" in data:
            resp_content = data["response"].get("content", [])
            if (
                resp_content
                and isinstance(resp_content[0], dict)
                and "text" in resp_content[0]
            ):
                reply = resp_content[0]["text"]

    except Exception as e:
        logger.exception("Error extracting text: %s", e)

    if not reply:
        short = None
        try:
            short = json.dumps(data, indent=None)[:8000]
        except Exception:
            short = str(data)[:8000]
        note = "No text found in Gemini response. See raw provider output (truncated)."
        return Response(
            {"response": None, "note": note, "raw": short},
            status=status.HTTP_200_OK,
        )

    return Response({"response": reply}, status=status.HTTP_200_OK)
