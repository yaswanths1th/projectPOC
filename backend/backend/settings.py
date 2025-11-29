import os
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# =====================================================================
# SECRET KEY
# =====================================================================
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("❌ DJANGO_SECRET_KEY missing in .env")

DEBUG = os.getenv("DJANGO_DEBUG", "True") == "True"

ALLOWED_HOSTS = os.getenv(
    "DJANGO_ALLOWED_HOSTS",
    "127.0.0.1,localhost"
).split(",")

# =====================================================================
# APPS
# =====================================================================
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",

    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",

    "apps.accounts",
    "apps.addresses",
    "apps.password_reset",
    "apps.viewprofile",
    "apps.change_password",
]

# =====================================================================
# MIDDLEWARE
# =====================================================================
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "apps.accounts.middleware.RateLimitMiddleware",  # 🔐 Rate limiting
]

ROOT_URLCONF = "backend.urls"

# =====================================================================
# DATABASE
# =====================================================================
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB", "Login"),
        "USER": os.getenv("POSTGRES_USER", "postgres"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", "root"),
        "HOST": os.getenv("POSTGRES_HOST", "localhost"),
        "PORT": os.getenv("POSTGRES_PORT", "5432"),
    }
}

AUTH_USER_MODEL = "accounts.User"

# =====================================================================
# DRF + JWT
# =====================================================================
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "apps.accounts.authentication.CookieJWTAuthentication",  # 🔐 Custom: Read from cookies
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.AllowAny",
    ),
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "login": "5/min",              # 🔐 Login: 5 attempts per minute
        "otp_send": "3/min",           # 🔐 OTP send: 3 per minute per IP
        "otp_verify": "5/min",         # 🔐 OTP verify: 5 attempts per minute
        "anon": "100/min",
        "user": "1000/hour",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "AUTH_HEADER_TYPES": ("Bearer",),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    # 🔐 Cookie names (not Authorization header)
    "AUTH_COOKIE": "access_token",
    "AUTH_COOKIE_REFRESH": "refresh_token",
    "AUTH_COOKIE_SAMESITE": "Lax",
    "AUTH_COOKIE_SECURE": False,  # localhost only: set to False for dev
    "AUTH_COOKIE_HTTP_ONLY": True,
}

# =====================================================================
# CORS
# =====================================================================
CORS_ALLOWED_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]

# 🔐 SECURITY FIX: Allow credentials (cookies) in CORS requests
CORS_ALLOW_CREDENTIALS = True

# 🔐 Restrict allowed methods
CORS_ALLOW_METHODS = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]

# 🔐 Allow necessary headers
CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
]

# =====================================================================
# TEMPLATES
# =====================================================================
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

STATIC_URL = "/static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# =====================================================================
# EMAIL (Console Mode = OTP prints in terminal)
# =====================================================================
# =====================================================================
# EMAIL SETTINGS (GMAIL SMTP)
# =====================================================================

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"

EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587
EMAIL_USE_TLS = True

# Load secure credentials from .env (DO NOT hard-code Gmail password)
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER")         # your Gmail
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD") # Gmail App Password

DEFAULT_FROM_EMAIL = EMAIL_HOST_USER

# Warn if credentials missing
if not EMAIL_HOST_USER or not EMAIL_HOST_PASSWORD:
    print("⚠️ WARNING: Missing Gmail settings in .env — OTP email may not send")


# =====================================================================
# SECURITY (LOCAL DEV)
# =====================================================================
# 🔐 Localhost settings (change for production!)
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
SESSION_COOKIE_HTTPONLY = True      # 🔐 Prevent JavaScript access
CSRF_COOKIE_HTTPONLY = True         # 🔐 Prevent JavaScript access
SESSION_COOKIE_SAMESITE = "Lax"     # 🔐 CSRF protection
CSRF_COOKIE_SAMESITE = "Lax"        # 🔐 CSRF protection
SECURE_SSL_REDIRECT = False

# 🔐 CSRF trusted origins
CSRF_TRUSTED_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
]

# OTP expiry
OTP_EXPIRY_MINUTES = 5

# 🔐 OTP Security Settings
OTP_COOLDOWN_SECONDS = 60          # 60-sec cooldown per email
OTP_MAX_ATTEMPTS_PER_IP = 10       # Max OTP attempts per IP per hour
