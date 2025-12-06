# backend/apps/subscriptions/views.py
import os
import logging
import requests
from django.apps import apps

from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework import permissions

from django.shortcuts import get_object_or_404
from django.db import transaction
from django.contrib.auth import get_user_model

from .serializers import (
    PlanSerializer,
    UserSubscriptionSerializer,
    UserProfileSerializer,
    CreateSubscriptionSerializer,
)

logger = logging.getLogger(__name__)

# Helpers to find models robustly
def get_model(label_candidates, model_name):
    for lbl in label_candidates:
        try:
            return apps.get_model(lbl, model_name)
        except LookupError:
            continue
    for lbl in ("subscriptions", "apps.subscriptions", "apps.subscriptions.models"):
        try:
            return apps.get_model(lbl, model_name)
        except LookupError:
            continue
    return None

def get_user_subscription_model():
    return get_model(["apps.subscriptions", "subscriptions"], "UserSubscription")

def get_plan_model():
    m = get_model(["apps.subscriptions", "subscriptions"], "Plan")
    if m is None:
        m = get_model(["apps.subscriptions", "subscriptions"], "SubscriptionPlan")
    return m

# ----------------------------
# Public endpoints
# ----------------------------
@api_view(['GET'])
def plans_list(request):
    Plan = get_plan_model()
    if Plan is None:
        return Response([], status=status.HTTP_200_OK)
    plans = Plan.objects.filter(is_active=True).order_by('price_cents')
    serializer = PlanSerializer(plans, many=True)
    return Response(serializer.data)

# ----------------------------
# Subscription endpoints
# ----------------------------
class SubscribeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = CreateSubscriptionSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        sub = serializer.save()

        # Build a subscription payload
        try:
            subscription_data = UserSubscriptionSerializer(sub).data
        except Exception:
            subscription_data = {
                "id": getattr(sub, "id", None),
                "user_id": getattr(sub, "user_id", None),
                "plan_id": getattr(sub, "plan_id", None),
                "status": getattr(sub, "status", None),
                "active": getattr(sub, "active", getattr(sub, "is_active", True)),
                "start_date": getattr(sub, "start_date", getattr(sub, "started_at", None)),
                "end_date": getattr(sub, "end_date", getattr(sub, "expires_at", None)),
                "auto_renew": getattr(sub, "auto_renew", False),
                "payment_provider": getattr(sub, "payment_provider", None),
                "payment_reference": getattr(sub, "payment_reference", None)
            }

        # Re-fetch the user from DB to ensure fresh relations (including subscription)
        User = get_user_model()
        try:
            fresh_user = User.objects.get(pk=request.user.pk)
        except Exception:
            fresh_user = request.user  # fallback

        # Try to return an enriched profile (this serializer includes subscription info)
        try:
            user_profile = UserProfileSerializer(fresh_user).data
        except Exception:
            # fallback to simple user serializer if available
            try:
                from apps.accounts.serializers import UserSerializer
                user_profile = UserSerializer(fresh_user).data
            except Exception:
                user_profile = None

        response_payload = {"subscription": subscription_data}
        if user_profile:
            response_payload["user"] = user_profile

        return Response(response_payload, status=status.HTTP_200_OK)
    

    
class SubscriptionDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        UserSubscription = get_user_subscription_model()
        if UserSubscription is None:
            return Response(None, status=status.HTTP_204_NO_CONTENT)

        # filter using 'active' boolean field (fall back to 'is_active' if necessary)
        try:
            sub = UserSubscription.objects.filter(user_id=request.user.id, active=True).order_by("-started_at").first()
        except Exception:
            sub = UserSubscription.objects.filter(user_id=request.user.id).order_by("-started_at").first()

        if not sub:
            return Response(None, status=status.HTTP_204_NO_CONTENT)
        out = None
        try:
            out = UserSubscriptionSerializer(sub).data
        except Exception:
            out = {
                "id": getattr(sub, "id", None),
                "user_id": getattr(sub, "user_id", None),
                "plan_id": getattr(sub, "plan_id", None),
                "plan_slug": getattr(getattr(sub, "plan", None), "slug", None),
                "status": getattr(sub, "status", None),
                "active": getattr(sub, "active", getattr(sub, "is_active", True)),
                "started_at": getattr(sub, "started_at", getattr(sub, "start_date", None)),
                "end_date": getattr(sub, "end_date", getattr(sub, "expires_at", None)),
                "auto_renew": getattr(sub, "auto_renew", False),
                "payment_provider": getattr(sub, "payment_provider", None),
                "payment_reference": getattr(sub, "payment_reference", None),
            }
        return Response(out, status=status.HTTP_200_OK)

# ----------------------------
# Profile + helper endpoints
# ----------------------------
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile_view(request):
    serializer = UserProfileSerializer(request.user)
    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_subscription(request):
    UserSubscription = get_user_subscription_model()
    if UserSubscription is None:
        return Response({"slug": "free", "can_use_ai": False}, status=200)

    # try filter by 'active' then 'is_active' then fallback to any
    sub = None
    try:
        sub = UserSubscription.objects.filter(user=request.user, active=True).order_by('-started_at', '-created_at').first()

    except Exception:
        try:
            sub = UserSubscription.objects.filter(user=request.user, is_active=True).order_by('-started_at', '-created_at').first()
        except Exception:
            sub = UserSubscription.objects.filter(user=request.user).order_by('-started_at', '-created_at').first()

    if not sub:
        return Response({"slug": "free", "can_use_ai": False}, status=200)

    plan = getattr(sub, "plan", None)
    plan_slug = getattr(plan, "slug", None)
    plan_name = getattr(plan, "name", None)
    can_use_ai = bool(getattr(plan, "can_use_ai", False))
    price_cents = getattr(plan, "price_cents", None)

    end_date = getattr(sub, "end_date", None) or getattr(sub, "expires_at", None) or None

    return Response({
        "id": getattr(sub, "id", None),
        "slug": plan_slug,
        "name": plan_name,
        "active": bool(getattr(sub, "active", getattr(sub, "is_active", True))),
        "start_date": getattr(sub, "started_at", getattr(sub, "start_date", None)).isoformat() if getattr(sub, "started_at", getattr(sub, "start_date", None)) else None,
        "end_date": end_date.isoformat() if end_date else None,
        "can_use_ai": can_use_ai,
        "price_cents": price_cents
    }, status=200)

# ----------------------------
# AI proxy endpoint (unchanged logic)
# ----------------------------
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ai_free_chat(request):
    import json
    user = request.user
    prompt = request.data.get("prompt") or ""
    if not isinstance(prompt, str) or prompt.strip() == "":
        return Response({"detail": "prompt required"}, status=status.HTTP_400_BAD_REQUEST)

    if not GEMINI_API_KEY:
        logger.error("GEMINI_API_KEY missing from environment")
        return Response({"detail": "GEMINI_API_KEY missing from server"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    gf_model = os.getenv("GEMINI_MODEL", GEMINI_MODEL)
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{gf_model}:generateContent"
    headers = {"Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY}

    payload = {
        "contents": [
            {"parts": [{"text": prompt}]}
        ],
        "generationConfig": {
            "candidateCount": 1,
            "temperature": 0.7,
            "maxOutputTokens": 2048
        }
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=30)
    except requests.exceptions.Timeout:
        logger.exception("Timeout when calling Gemini API")
        return Response({"detail": "Gemini request timed out"}, status=status.HTTP_504_GATEWAY_TIMEOUT)
    except requests.exceptions.RequestException as exc:
        logger.exception("Network error calling Gemini API: %s", exc)
        return Response({"detail": "Gemini request failed", "error": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

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
        logger.warning("Gemini API returned non-2xx: %s - body: %s", resp.status_code, resp.text[:2000])
        return Response({"detail": "Gemini API error", "status": resp.status_code, "body": resp.text}, status=status.HTTP_502_BAD_GATEWAY)

    try:
        data = resp.json()
    except Exception:
        logger.exception("Failed to parse JSON from Gemini response")
        return Response({"detail": "Invalid response from Gemini API", "body": resp.text}, status=status.HTTP_502_BAD_GATEWAY)

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
                if cparts and isinstance(cparts[0], dict) and "text" in cparts[0]:
                    reply = cparts[0]["text"]

        if not reply and isinstance(data, dict) and "response" in data:
            resp_content = data["response"].get("content", [])
            if resp_content and isinstance(resp_content[0], dict) and "text" in resp_content[0]:
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
        return Response({"response": None, "note": note, "raw": short}, status=status.HTTP_200_OK)

    return Response({"response": reply}, status=status.HTTP_200_OK)
