"""Admin panel: «Tanga sotuvi», «Hisobotlar» va «Sozlamalar» sahifalari uchun ma'lumotlar (direktor, moliyachi).

Hamma summalar so'mda, butun sonlarda. Hech narsa o'zgartirilmaydi: faqat o'qiladi.
"""
from datetime import timedelta

from django.conf import settings
from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.payments.models import PaymentOrder
from apps.payments.packages import PACKAGES

from .earnings import IsFinanceStaff, _month_start
from .models import ChapterUnlock, RevenueSplit, Wallet, WalletTransaction, WithdrawalRequest


def _sum(qs, field, **flt):
    return qs.filter(**flt).aggregate(s=Sum(field))["s"] or 0


class AdminCoinSalesView(APIView):
    """GET /api/auth/admin/coin-sales/ — paketlar, shu oy sotuvi va oxirgi xaridlar."""
    permission_classes = [IsFinanceStaff]

    def get(self, request):
        month = _month_start(timezone.localtime())
        paid = PaymentOrder.objects.filter(status=PaymentOrder.Status.PAID)
        month_paid = paid.filter(paid_at__gte=month)
        mock_paid = paid.filter(provider=PaymentOrder.Provider.MOCK)

        packages = []
        for key, p in PACKAGES.items():
            agg = month_paid.filter(package=key).aggregate(n=Count("id"), som=Sum("amount_uzs"))
            packages.append({
                "package": key, "coins": p["coins"], "bonus": p["bonus"], "price_som": p["price"],
                "sold_month": agg["n"] or 0, "revenue_month_som": agg["som"] or 0,
            })

        purchases = [{
            "id": o.pk, "paid_at": o.paid_at, "user": o.user.full_name, "package": o.package,
            "coins": o.coins, "bonus_coins": o.bonus_coins, "amount_som": o.amount_uzs,
            "provider": o.provider, "provider_label": o.get_provider_display(),
        } for o in paid.select_related("user").order_by("-paid_at", "-id")[:50]]

        return Response({
            "rate_som": settings.COIN_RATE_SOM,
            "mock_enabled": settings.PAYMENTS_MOCK_ENABLED,
            "orders_month": month_paid.count(),
            "revenue_month_som": _sum(month_paid, "amount_uzs"),
            "coins_sold_month": _sum(month_paid, "coins") + _sum(month_paid, "bonus_coins"),
            "unfinished_orders": PaymentOrder.objects.filter(
                status__in=[PaymentOrder.Status.CREATED, PaymentOrder.Status.PREPARED]).count(),
            "mock_paid_count": mock_paid.count(),
            "mock_paid_som": _sum(mock_paid, "amount_uzs"),
            "packages": packages,
            "purchases": purchases,
        })


def _check(key, label, expected, actual, unit, hint):
    return {"key": key, "label": label, "expected": expected, "actual": actual,
            "diff": actual - expected, "ok": expected == actual, "unit": unit, "hint": hint}


class AdminReportsView(APIView):
    """GET /api/auth/admin/reports/ — oylik hisobot va hisob-kitob (tanga/pul) izchilligi tekshiruvi."""
    permission_classes = [IsFinanceStaff]

    def get(self, request):
        now = timezone.localtime()
        paid_orders = PaymentOrder.objects.filter(status=PaymentOrder.Status.PAID)
        splits = RevenueSplit.objects.all()
        withdrawn = WithdrawalRequest.objects.filter(status="paid")
        tx = WalletTransaction.objects

        months = []
        for back in range(5, -1, -1):
            start = _month_start(now, back)
            end = _month_start(now, back - 1) if back else now + timedelta(days=1)
            months.append({
                "month": start.strftime("%Y-%m"),
                "sold_som": _sum(paid_orders, "amount_uzs", paid_at__gte=start, paid_at__lt=end),
                "unlocks": splits.filter(created_at__gte=start, created_at__lt=end).count(),
                "unlocks_som": _sum(splits, "gross_som", created_at__gte=start, created_at__lt=end),
                "writers_som": _sum(splits, "writer_som", created_at__gte=start, created_at__lt=end),
                "platform_som": _sum(splits, "platform_som", created_at__gte=start, created_at__lt=end),
                "withdrawn_som": _sum(withdrawn, "amount_som", processed_at__gte=start,
                                      processed_at__lt=end),
            })

        purchase_coins = _sum(tx, "amount", kind=WalletTransaction.Kind.PURCHASE)
        adjust_coins = _sum(tx, "amount", kind=WalletTransaction.Kind.ADJUSTMENT)
        unlock_coins = _sum(tx, "amount", kind=WalletTransaction.Kind.CHAPTER_UNLOCK)
        order_coins = _sum(paid_orders, "coins") + _sum(paid_orders, "bonus_coins")

        checks = [
            _check("wallet_balance", "Hamyonlardagi tangalar",
                   purchase_coins + adjust_coins - unlock_coins,
                   Wallet.objects.aggregate(s=Sum("balance"))["s"] or 0, "tanga",
                   "Sotib olingan + qo'lda qo'shilgan − bob ochishga sarflangan"),
            _check("orders_vs_wallet", "To'langan buyurtmalar va hamyon yozuvlari",
                   order_coins, purchase_coins, "tanga",
                   "Har bir to'langan buyurtma hamyonga aynan shuncha tanga qo'shgan bo'lishi kerak"),
            _check("unlocks_vs_splits", "Bob ochilishlari va pul bo'linishlari",
                   ChapterUnlock.objects.count(), splits.count(), "ta",
                   "Har bir ochilishga bitta 70/30 bo'linish yozuvi"),
            _check("split_coins", "Sarflangan tangalar va bo'linish yozuvlari",
                   unlock_coins, _sum(splits, "coins"), "tanga",
                   "Hamyondan yechilgan tanga bo'linishdagi tanga bilan teng"),
            _check("split_sums", "Yozuvchi + platforma ulushi = umumiy summa",
                   _sum(splits, "gross_som"),
                   _sum(splits, "writer_som") + _sum(splits, "platform_som"), "so'm",
                   "Bo'linishda bir tiyin ham yo'qolmaydi"),
        ]

        writers_earned = _sum(splits, "writer_som")
        withdrawn_total = _sum(withdrawn, "amount_som")
        mock_paid = paid_orders.filter(provider=PaymentOrder.Provider.MOCK)
        return Response({
            "writer_percent": settings.WRITER_SHARE_PERCENT,
            "rate_som": settings.COIN_RATE_SOM,
            "sold_total_som": _sum(paid_orders, "amount_uzs"),
            "unlocks_total_som": _sum(splits, "gross_som"),
            "platform_total_som": _sum(splits, "platform_som"),
            "writers_earned_som": writers_earned,
            "withdrawn_total_som": withdrawn_total,
            "writers_payable_som": writers_earned - withdrawn_total,
            "mock_paid_count": mock_paid.count(),
            "mock_paid_som": _sum(mock_paid, "amount_uzs"),
            "months": months,
            "checks": checks,
            "mismatches": sum(1 for c in checks if not c["ok"]),
            "generated_at": now,
        })


class AdminSystemSettingsView(APIView):
    """GET /api/auth/admin/system-settings/ — joriy sozlamalar (faqat o'qish).

    Qiymatlar serverning .env faylidan keladi. Maxfiy kalitlar (parol, SECRET_KEY, Click kaliti)
    hech qachon qaytarilmaydi: faqat «sozlangan / sozlanmagan» holati.
    """
    permission_classes = [IsFinanceStaff]

    def get(self, request):
        click_ready = all([settings.CLICK_SERVICE_ID, settings.CLICK_MERCHANT_ID,
                           settings.CLICK_SECRET_KEY])
        return Response({
            "writer_percent": settings.WRITER_SHARE_PERCENT,
            "rate_som": settings.COIN_RATE_SOM,
            "min_withdrawal_som": settings.MIN_WITHDRAWAL_SOM,
            "director_approval_som": settings.DIRECTOR_APPROVAL_SOM,
            "adjustment_finance_limit_coins": settings.WALLET_ADJUSTMENT_FINANCE_LIMIT_COINS,
            "adjustment_max_coins": settings.WALLET_ADJUSTMENT_MAX_COINS,
            "click_configured": click_ready,
            "payme_connected": False,
            "mock_enabled": settings.PAYMENTS_MOCK_ENABLED,
            "email_smtp": settings.EMAIL_BACKEND.endswith("smtp.EmailBackend"),
            "debug": settings.DEBUG,
        })