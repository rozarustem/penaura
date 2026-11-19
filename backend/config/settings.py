import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.environ["SECRET_KEY"]

DEBUG = os.environ.get("DEBUG", "False") == "True"


def env_list(name, default=""):
    """.env dagi vergul bilan ajratilgan qiymatni ro'yxatga aylantiradi."""
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


ALLOWED_HOSTS = env_list("ALLOWED_HOSTS")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # tashqi paketlar
    "rest_framework",
    "corsheaders",
    "django_filters",
    # bizning app'lar
    "apps.core",
    "apps.accounts",
    "apps.catalog",
    "apps.payments",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Ma'lumotlar bazasi: .env da DB_NAME bo'lsa PostgreSQL ishlatiladi.
# DB_NAME yo'q bo'lsa (faqat lokal sinov uchun) sqlite'ga qaytadi.
if os.environ.get("DB_NAME"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ["DB_NAME"],
            "USER": os.environ.get("DB_USER", "postgres"),
            "PASSWORD": os.environ.get("DB_PASSWORD", ""),
            "HOST": os.environ.get("DB_HOST", "127.0.0.1"),
            "PORT": os.environ.get("DB_PORT", "5432"),
            "CONN_MAX_AGE": 60,
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "uz"
TIME_ZONE = "Asia/Tashkent"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"  # python manage.py collectstatic shu yerga yig'adi
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Amazon S3: AWS_STORAGE_BUCKET_NAME berilsa, yuklangan fayllar (muqova, avatar) S3 da saqlanadi.
# Kalitlar kodda/.env da YO'Q: EC2 ga biriktirilgan IAM rol orqali avtomatik olinadi.
# Berilmasa (lokal ishlash) fayllar diskdagi media/ papkasida qoladi.
AWS_STORAGE_BUCKET_NAME = os.environ.get("AWS_STORAGE_BUCKET_NAME", "")
if AWS_STORAGE_BUCKET_NAME:
    AWS_S3_REGION_NAME = os.environ.get("AWS_S3_REGION_NAME", "ap-southeast-2")
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = True        # bucket yopiq; fayllar vaqtinchalik imzolangan URL bilan beriladi
    AWS_QUERYSTRING_EXPIRE = 3600
    AWS_S3_FILE_OVERWRITE = False
    STORAGES = {
        "default": {"BACKEND": "storages.backends.s3.S3Storage"},
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Frontend va admin panel joylashgan domenlar (.env: CORS_ALLOWED_ORIGINS=https://penaura.uz,https://admin.penaura.uz)
# DEBUG yoqilganda lokal Live Server manzillari avtomatik qo'shiladi.
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS")
if DEBUG:
    CORS_ALLOWED_ORIGINS += [
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5501",
    ]
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")

# Productionda (DEBUG=False) HTTPS bilan bog'liq xavfsizlik sozlamalari
if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(os.environ.get("SECURE_HSTS_SECONDS", "0"))  # HTTPS ishlagach 31536000 qiling
    SECURE_CONTENT_TYPE_NOSNIFF = True
    if os.environ.get("BEHIND_PROXY", "False") == "True":  # nginx orqali ishlasa
        SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
        SECURE_SSL_REDIRECT = True

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.accounts.authentication.ActiveUserJWTAuthentication",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_RATES": {
        "password_reset": "5/hour",
        "password_reset_confirm": "10/hour",
        "login": "20/minute",
        "register": "20/hour",
        "email_verify": "20/hour",
        "email_resend": "10/hour",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "UPDATE_LAST_LOGIN": True,  # admin panelda "oxirgi kirish" ko'rinishi uchun
}

# --- Email va parolni tiklash ---
# .env da EMAIL_HOST_USER va EMAIL_HOST_PASSWORD bo'lsa haqiqiy email yuboriladi (SMTP),
# bo'lmasa xat backend terminalida chiqadi (rivojlantirish uchun).
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
if EMAIL_HOST_USER and EMAIL_HOST_PASSWORD:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = os.environ.get("EMAIL_HOST", "smtp.gmail.com")
    EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
    EMAIL_USE_TLS = True
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER or "Penaura <noreply@penaura.local>")

# Parol tiklash havolasi ochiladigan frontend manzili (oxirida "/" bilan)
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://127.0.0.1:5500/frontend/")
# Havola amal qilish muddati (soniya): 1 soat
PASSWORD_RESET_TIMEOUT = 3600

# To'lovlar
CLICK_SERVICE_ID = os.environ.get("CLICK_SERVICE_ID", "")
CLICK_MERCHANT_ID = os.environ.get("CLICK_MERCHANT_ID", "")
CLICK_SECRET_KEY = os.environ.get("CLICK_SECRET_KEY", "")
# Sinov to'lovi bepul tanga beradi. Ikki shart bir vaqtda kerak:
#   1) PAYMENTS_MOCK=True va
#   2) DEBUG=True (lokal ishlab chiqish) YOKI DEMO_MODE=True (internetdagi demo server, haqiqiy pulsiz).
# Haqiqiy (pulli) productionda DEMO_MODE ni yoqmang: sinov to'lovi har qanday foydalanuvchiga bepul tanga beradi.
DEMO_MODE = os.environ.get("DEMO_MODE", "False") == "True"
PAYMENTS_MOCK_ENABLED = (DEBUG or DEMO_MODE) and os.environ.get("PAYMENTS_MOCK", "False") == "True"

# Bob ochilganda pul shu foizda yozuvchiga, qolgani platformaga bo'linadi (70/30).
WRITER_SHARE_PERCENT = int(os.environ.get("WRITER_SHARE_PERCENT", "70"))
# 1 tanga necha so'm (yozuvchi daromadi shu kurs bo'yicha hisoblanadi).
COIN_RATE_SOM = int(os.environ.get("COIN_RATE_SOM", "1500"))
# Yozuvchi pul yechishining eng kam summasi va direktor tasdig'i kerak bo'ladigan chegara (so'm).
MIN_WITHDRAWAL_SOM = int(os.environ.get("MIN_WITHDRAWAL_SOM", "10000"))
DIRECTOR_APPROVAL_SOM = int(os.environ.get("DIRECTOR_APPROVAL_SOM", "500000"))

# Qo'lda tanga qo'shish (balans tuzatish): bir martalik chegara va moliyachi o'zi qo'sha oladigan miqdor.
WALLET_ADJUSTMENT_MAX_COINS = int(os.environ.get("WALLET_ADJUSTMENT_MAX_COINS", "1000"))
WALLET_ADJUSTMENT_FINANCE_LIMIT_COINS = int(os.environ.get("WALLET_ADJUSTMENT_FINANCE_LIMIT_COINS", "50"))