"""Click SHOP-API (Prepare / Complete).

Hujjat: https://docs.click.uz/en/click-api-request/
Imzo (sign_string):
  Prepare : md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + amount + action + sign_time)
  Complete: md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + merchant_prepare_id + amount + action + sign_time)
Qiymatlar Click yuborgan matn ko'rinishida (o'zgartirilmasdan) birlashtiriladi.
"""
import hashlib
import hmac
import logging
from decimal import Decimal, InvalidOperation
from urllib.parse import urlencode

from django.conf import settings

from .models import PaymentOrder
from .services import OrderCancelled, cancel_order, fulfill_order

logger = logging.getLogger(__name__)

SUCCESS = 0
SIGN_FAILED = -1
INCORRECT_AMOUNT = -2
ACTION_NOT_FOUND = -3
ALREADY_PAID = -4
ORDER_NOT_FOUND = -5
TRANSACTION_NOT_FOUND = -6
UPDATE_FAILED = -7
REQUEST_ERROR = -8
CANCELLED = -9

NOTES = {
    SUCCESS: "Success",
    SIGN_FAILED: "SIGN CHECK FAILED!",
    INCORRECT_AMOUNT: "Incorrect parameter amount",
    ACTION_NOT_FOUND: "Action not found",
    ALREADY_PAID: "Already paid",
    ORDER_NOT_FOUND: "User does not exist",
    TRANSACTION_NOT_FOUND: "Transaction does not exist",
    UPDATE_FAILED: "Failed to update user",
    REQUEST_ERROR: "Error in request from click",
    CANCELLED: "Transaction cancelled",
}

PREPARE_FIELDS = ("click_trans_id", "service_id", "merchant_trans_id", "amount", "action", "sign_time", "sign_string")
COMPLETE_FIELDS = PREPARE_FIELDS + ("merchant_prepare_id",)


def build_pay_url(order, return_url):
    params = {
        "service_id": settings.CLICK_SERVICE_ID,
        "merchant_id": settings.CLICK_MERCHANT_ID,
        "amount": f"{order.amount_uzs}.00",
        "transaction_param": order.pk,
        "return_url": return_url,
    }
    return "https://my.click.uz/services/pay?" + urlencode(params)


def make_sign(data, complete):
    parts = [data["click_trans_id"], data["service_id"], settings.CLICK_SECRET_KEY,
             data["merchant_trans_id"]]
    if complete:
        parts.append(data["merchant_prepare_id"])
    parts += [data["amount"], data["action"], data["sign_time"]]
    return hashlib.md5("".join(parts).encode("utf-8")).hexdigest()


def _reply(data, code, **extra):
    body = {
        "click_trans_id": data.get("click_trans_id"),
        "merchant_trans_id": data.get("merchant_trans_id"),
        "error": code,
        "error_note": NOTES[code],
    }
    body.update(extra)
    return body


def _validate(data, complete):
    """Umumiy tekshiruvlar. (xato_kodi, order) qaytaradi."""
    required = COMPLETE_FIELDS if complete else PREPARE_FIELDS
    if any(data.get(name) in (None, "") for name in required):
        return REQUEST_ERROR, None
    if not settings.CLICK_SECRET_KEY or str(data["service_id"]) != str(settings.CLICK_SERVICE_ID):
        return REQUEST_ERROR, None
    if not hmac.compare_digest(make_sign(data, complete), str(data["sign_string"])):
        return SIGN_FAILED, None
    if str(data["action"]) != ("1" if complete else "0"):
        return ACTION_NOT_FOUND, None
    try:
        order = PaymentOrder.objects.get(pk=int(data["merchant_trans_id"]),
                                         provider=PaymentOrder.Provider.CLICK)
    except (PaymentOrder.DoesNotExist, ValueError):
        return ORDER_NOT_FOUND, None
    try:
        if Decimal(str(data["amount"])) != Decimal(order.amount_uzs):
            return INCORRECT_AMOUNT, order
    except InvalidOperation:
        return REQUEST_ERROR, order
    return SUCCESS, order


def prepare(data):
    code, order = _validate(data, complete=False)
    if code != SUCCESS:
        return _reply(data, code)
    if order.status == PaymentOrder.Status.PAID:
        return _reply(data, ALREADY_PAID)
    if order.status == PaymentOrder.Status.CANCELLED:
        return _reply(data, CANCELLED)

    order.status = PaymentOrder.Status.PREPARED
    order.external_id = str(data["click_trans_id"])
    order.save(update_fields=["status", "external_id", "updated_at"])
    return _reply(data, SUCCESS, merchant_prepare_id=order.pk)


def complete(data):
    code, order = _validate(data, complete=True)
    if code != SUCCESS:
        return _reply(data, code)
    if str(data["merchant_prepare_id"]) != str(order.pk) \
            or order.external_id != str(data["click_trans_id"]):
        return _reply(data, TRANSACTION_NOT_FOUND)

    try:
        click_error = int(data.get("error", 0))
    except (TypeError, ValueError):
        return _reply(data, REQUEST_ERROR)

    if click_error < 0:  # Click tomonda yechib olish bekor bo'ldi
        _, changed = cancel_order(order.pk)
        return _reply(data, CANCELLED if changed else ALREADY_PAID)

    if order.status == PaymentOrder.Status.PAID:
        return _reply(data, ALREADY_PAID)
    try:
        fulfill_order(order.pk)
    except OrderCancelled:
        return _reply(data, CANCELLED)
    except Exception:
        logger.exception("Click complete: buyurtma %s bajarilmadi", order.pk)
        return _reply(data, UPDATE_FAILED)
    return _reply(data, SUCCESS, merchant_confirm_id=order.pk)


def handle(data):
    action = str(data.get("action", ""))
    if action == "0":
        return prepare(data)
    if action == "1":
        return complete(data)
    return _reply(data, ACTION_NOT_FOUND)
