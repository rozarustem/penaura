"""Email tasdiqlash: 6 xonali kod yaratish, yuborish va tekshirish."""
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac

from .models import EmailVerificationCode

logger = logging.getLogger(__name__)

CODE_TTL = timedelta(minutes=15)
RESEND_COOLDOWN = timedelta(seconds=60)
MAX_ATTEMPTS = 5

OK, INVALID, EXPIRED, LOCKED = "ok", "invalid", "expired", "locked"


def _hash(user, code):
    return salted_hmac("penaura.email_verification", f"{user.pk}:{code}").hexdigest()


def can_send(user):
    record = EmailVerificationCode.objects.filter(user=user).first()
    return record is None or timezone.now() - record.sent_at >= RESEND_COOLDOWN


def send_code(user):
    """Yangi kod yaratadi (eskisi bekor bo'ladi) va emailga yuboradi. Yuborildimi — True/False."""
    code = f"{secrets.randbelow(10 ** 6):06d}"
    EmailVerificationCode.objects.update_or_create(
        user=user,
        defaults={"code_hash": _hash(user, code), "sent_at": timezone.now(), "attempts": 0},
    )
    minutes = int(CODE_TTL.total_seconds() // 60)
    try:
        send_mail(
            "Penaura: email tasdiqlash kodi",
            f"Salom, {user.full_name}!\n\n"
            f"Penaura akkauntingizni tasdiqlash kodi: {code}\n\n"
            f"Kod {minutes} daqiqa amal qiladi. Agar ro'yxatdan o'tmagan bo'lsangiz, bu xatni "
            f"e'tiborsiz qoldiring.",
            settings.DEFAULT_FROM_EMAIL, [user.email],
        )
        return True
    except Exception:
        logger.exception("Tasdiqlash kodini yuborib bo'lmadi")
        return False


def check_code(user, code):
    """Kodni tekshiradi. Muvaffaqiyatda email_verified=True qilinadi va kod o'chiriladi."""
    record = EmailVerificationCode.objects.filter(user=user).first()
    if record is None:
        return INVALID
    if timezone.now() - record.sent_at > CODE_TTL:
        return EXPIRED
    if record.attempts >= MAX_ATTEMPTS:
        return LOCKED
    if not constant_time_compare(record.code_hash, _hash(user, str(code).strip())):
        record.attempts += 1
        record.save(update_fields=["attempts"])
        return LOCKED if record.attempts >= MAX_ATTEMPTS else INVALID
    user.email_verified = True
    user.save(update_fields=["email_verified"])
    record.delete()
    return OK