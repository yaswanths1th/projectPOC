# backend/apps/subscriptions/views.py
import os
import logging
import requests

from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from django.shortcuts import get_object_or_404
from django.db import transaction

from .models import Plan, UserSubscription
from .serializers import PlanSerializer, UserSubscriptionSerializer, UserProfileSerializer

logger = logging.getLogger(__name__)


@api_view(['GET'])
def plans_list(request):
    """Public: list all active plans"""
    plans = Plan.objects.filter(is_active=True).order_by('price_cents')
    serializer = PlanSerializer(plans, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def subscribe_view(request):
    plan_slug = request.data.get('plan_slug')
    if not plan_slug:
        return Response({"detail": "plan_slug is required"}, status=status.HTTP_400_BAD_REQUEST)

    # don't create 'free' as an active subscription through this endpoint
    if str(plan_slug).strip().lower() == "free":
        sub = UserSubscription.objects.filter(user=request.user, active=True).order_by('-start_date').first()
        if sub:
            return Response({"subscription": {
                "id": sub.id,
                "slug": sub.plan.slug,
                "name": sub.plan.name,
                "is_active": True,
                "start_date": sub.start_date,
                "end_date": sub.end_date,
                "can_use_ai": bool(sub.plan.can_use_ai)
            }}, status=status.HTTP_200_OK)
        return Response({"subscription": {"slug": "free", "can_use_ai": False}}, status=status.HTTP_200_OK)

    plan = get_object_or_404(Plan, slug=plan_slug, is_active=True)

    payment_provider = request.data.get('payment_provider')
    payment_reference = request.data.get('payment_reference')

    with transaction.atomic():
        # deactivate previous active subscriptions
        UserSubscription.objects.filter(user=request.user, active=True).update(active=False, status='expired')

        # create new active subscription
        new_sub = UserSubscription.objects.create(
            user=request.user,
            plan=plan,
            active=True,
            status='active',
            payment_provider=payment_provider or None,
            payment_reference=payment_reference or None
        )

        # set start_date / end_date based on plan.interval
        try:
            new_sub.start_date = timezone.now()
            new_sub.end_date = new_sub.set_expiry_for_interval()  # adapt if your method sets expires / end_date
            new_sub.save(update_fields=['start_date', 'end_date', 'active', 'status', 'expires_at'])
        except Exception:
            logger.exception("Failed to set expiry on subscription")

    # build response payload
    subscription_payload = {
        "id": new_sub.id,
        "slug": new_sub.plan.slug,
        "name": new_sub.plan.name,
        "is_active": bool(new_sub.active),
        "start_date": new_sub.start_date.isoformat() if new_sub.start_date else None,
        "end_date": new_sub.end_date.isoformat() if getattr(new_sub, 'end_date', None) else (new_sub.expires_at.isoformat() if new_sub.expires_at else None),
        "can_use_ai": bool(new_sub.plan.can_use_ai),
        "price_cents": getattr(new_sub.plan, 'price_cents', None),
    }

    # return canonical subscription (and optionally updated user profile)
    user_serialized = UserProfileSerializer(request.user).data
    return Response({"user": user_serialized, "subscription": subscription_payload}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile_view(request):
    """Return serialized authenticated user profile (UserProfileSerializer)."""
    serializer = UserProfileSerializer(request.user)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_subscription(request):
    sub = UserSubscription.objects.filter(user=request.user, active=True).order_by('-start_date', '-created_at').first()
    if not sub:
        return Response({"slug": "free", "can_use_ai": False}, status=200)

    return Response({
        "id": sub.id,
        "slug": sub.plan.slug,
        "name": sub.plan.name,
        "is_active": bool(sub.active),
        "start_date": sub.start_date.isoformat() if sub.start_date else None,
        "end_date": sub.end_date.isoformat() if getattr(sub, 'end_date', None) else (sub.expires_at.isoformat() if sub.expires_at else None),
        "can_use_ai": bool(sub.plan.can_use_ai),
        "price_cents": getattr(sub.plan, 'price_cents', None)
    }, status=200)


# ---------------------------
# AI proxy endpoint left intact (unchanged logic)
# ---------------------------

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

    # extract text (various shapes)
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
