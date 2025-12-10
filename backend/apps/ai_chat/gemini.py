# apps/ai_chat/gemini.py
import os
import requests

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")  # make sure this is in your .env
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"


def call_gemini(prompt: str) -> str:
    """
    Call Gemini with a simple text prompt and return plain text reply.
    Adapt this to match your existing working code.
    """
    if not GEMINI_API_KEY:
        # fallback so app doesn't fully crash
        return f"(Gemini API key missing) You said: {prompt}"

    payload = {
        "contents": [
            {
                "parts": [{"text": prompt}]
            }
        ]
    }

    params = {"key": GEMINI_API_KEY}
    headers = {"Content-Type": "application/json"}

    resp = requests.post(GEMINI_URL, json=payload, headers=headers, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    # Extract first candidate text safely
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        # if structure is unexpected, just return the JSON
        return str(data)[:800]
