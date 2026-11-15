from django.db import transaction
from django.utils import timezone

from apps.accounts.models import Wallet, WalletTransaction

from .models import PaymentOrder
from .packages import PACKAGES


class PaymentError(Exception):
    pass


class OrderCancelled(PaymentError):
    pass


def create_order(user, package_key, provider):
    package = PACKAGES.get(str(package_key))
    if not package:
        raise PaymentError("Paket topilmadi.")
    return PaymentOrder.objects.create(
        user=user,
        provider=provider,
        package=str(package_key),
        coins=package["coins"],
        bonus_coins=package["bonus"],
        amount_uzs=package["price"],
    )


def fulfill_order(order_id):
    """Buyurtmani to'langan deb belgilab, tangani hamyonga qo'shadi.

    Takror chaqirilsa ham tanga faqat BIR marta qo'shiladi.
    Qaytaradi: (order, yangi_to'landimi).
    """
    with transaction.atomic():
        order = PaymentOrder.objects.select_for_update().get(pk=order_id)
        if order.status == PaymentOrder.Status.PAID:
            return order, False
        if order.status == PaymentOrder.Status.CANCELLED:
            raise OrderCancelled("Buyurtma bekor qilingan.")

        wallet, _ = Wallet.objects.select_for_update().get_or_create(user=order.user)
        wallet.balance += order.total_coins
        wallet.save(update_fields=["balance", "updated_at"])

        entry = WalletTransaction.objects.create(
            wallet=wallet,
            kind=WalletTransaction.Kind.PURCHASE,
            amount=order.total_coins,
            balance_after=wallet.balance,
            reference=f"order:{order.pk}:{order.provider}",
        )
        order.status = PaymentOrder.Status.PAID
        order.paid_at = timezone.now()
        order.wallet_transaction = entry
        order.save(update_fields=["status", "paid_at", "wallet_transaction", "updated_at"])
    return order, True


def cancel_order(order_id):
    with transaction.atomic():
        order = PaymentOrder.objects.select_for_update().get(pk=order_id)
        if order.status == PaymentOrder.Status.PAID:
            return order, False
        order.status = PaymentOrder.Status.CANCELLED
        order.save(update_fields=["status", "updated_at"])
    return order, True
