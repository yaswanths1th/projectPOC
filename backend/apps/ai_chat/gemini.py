# apps/ai_chat/gemini.py
import requests
from django.conf import settings


GEMINI_API_KEY = getattr(settings, "GEMINI_API_KEY", None)
GEMINI_MODEL = getattr(settings, "GEMINI_MODEL", "gemini-2.5-flash")

GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)


def call_gemini(prompt: str) -> str:
    """
    Call Gemini with a simple text prompt and return plain text reply.
    """

    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured in Django settings")

    payload = {
        "contents": [
            {
                "parts": [{"text": prompt}]
            }
        ]
    }

    params = {"key": GEMINI_API_KEY}
    headers = {"Content-Type": "application/json"}

    resp = requests.post(
        GEMINI_URL,
        json=payload,
        headers=headers,
        params=params,
        timeout=30,
    )
    resp.raise_for_status()
    data = resp.json()

    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        return str(data)[:800]
