"""Pulni 70/30 bo'lish, yozuvchi daromadi, yechib olish va moliya paneli.

Kirim (tanga xaridi) apps.payments.PaymentOrder dan olinadi (status="paid").

Hamma summalar so'mda, BUTUN sonlarda saqlanadi (float ishlatilmaydi).
"""
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.payments.models import PaymentOrder
from apps.payments.packages import PACKAGES

from .models import AuditLog, RevenueSplit, User, Wallet, WithdrawalRequest

def split_amount(coins):
    """Tangani so'mga aylantirib, yozuvchi va platforma ulushiga bo'ladi.

    Yozuvchi ulushi butun songa pasaytiriladi, qoldiq platformaga qoladi:
    writer + platform == gross har doim to'g'ri keladi.
    """
    rate = settings.COIN_RATE_SOM
    percent = settings.WRITER_SHARE_PERCENT
    gross = coins * rate
    writer = gross * percent // 100
    return {"rate_som": rate, "writer_percent": percent, "gross_som": gross,
            "writer_som": writer, "platform_som": gross - writer}


def writer_balance(writer):
    """Yozuvchining hisobi: jami daromad, yechilgan, kutilayotgan va hozir yechish mumkin bo'lgani."""
    earned = RevenueSplit.objects.filter(writer=writer).aggregate(s=Sum("writer_som"))["s"] or 0
    rows = WithdrawalRequest.objects.filter(writer=writer)
    paid = rows.filter(status="paid").aggregate(s=Sum("amount_som"))["s"] or 0
    pending = rows.filter(status="pending").aggregate(s=Sum("amount_som"))["s"] or 0
    return {"earned_som": earned, "paid_som": paid, "pending_som": pending,
            "available_som": earned - paid - pending}


class IsFinanceStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.role in ("direktor", "moliyachi"))


class IsWriterUser(permissions.BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.role == "writer")


# ---------------------------------------------------------------- yozuvchi daromadi

def _split_row(row):
    return {"id": row.id, "created_at": row.created_at, "coins": row.coins,
            "gross_som": row.gross_som, "writer_som": row.writer_som,
            "platform_som": row.platform_som, "writer_percent": row.writer_percent,
            "chapter": row.chapter.title, "book": row.chapter.book.title}


def _withdrawal_row(row):
    return {"id": row.id, "amount_som": row.amount_som, "card_last4": row.card_last4,
            "status": row.status, "reject_reason": row.reject_reason,
            "created_at": row.created_at, "processed_at": row.processed_at}


class WriterEarningsView(APIView):
    """GET /api/auth/earnings/ — yozuvchining o'z daromadi (faqat writer roli)."""
    permission_classes = [IsWriterUser]

    def get(self, request):
        splits = (RevenueSplit.objects.filter(writer=request.user)
                  .select_related("chapter", "chapter__book")[:50])
        withdrawals = WithdrawalRequest.objects.filter(writer=request.user)[:20]
        totals = RevenueSplit.objects.filter(writer=request.user).aggregate(
            gross=Sum("gross_som"), platform=Sum("platform_som"))
        return Response({
            **writer_balance(request.user),
            # O'quvchilar jami to'lagan summa va uning platformaga ketgan qismi (yozuvchiga ochiq ko'rsatiladi)
            "gross_som": totals["gross"] or 0,
            "platform_som": totals["platform"] or 0,
            "rate_som": settings.COIN_RATE_SOM,
            "writer_percent": settings.WRITER_SHARE_PERCENT,
            "min_withdrawal_som": settings.MIN_WITHDRAWAL_SOM,
            "splits": [_split_row(r) for r in splits],
            "withdrawals": [_withdrawal_row(r) for r in withdrawals],
        })


class WithdrawalCreateView(APIView):
    """POST /api/auth/earnings/withdraw/  {"amount_som": 50000, "card_last4": "4417"}"""
    permission_classes = [IsWriterUser]

    def post(self, request):
        try:
            amount = int(request.data.get("amount_som"))
        except (TypeError, ValueError):
            return Response({"amount_som": ["Summa butun son bo'lishi kerak."]}, status=400)
        card = str(request.data.get("card_last4", "")).strip()
        if not (card.isdigit() and len(card) == 4):
            return Response({"card_last4": ["Kartaning oxirgi 4 ta raqamini kiriting."]}, status=400)
        if amount < settings.MIN_WITHDRAWAL_SOM:
            return Response({"amount_som": [
                f"Eng kam summa: {settings.MIN_WITHDRAWAL_SOM} so'm."]}, status=400)
        with transaction.atomic():
            # Bir vaqtda ikki so'rov yuborib, balansdan ortiq yechib bo'lmasligi uchun qulflaymiz.
            User.objects.select_for_update().get(pk=request.user.pk)
            if amount > writer_balance(request.user)["available_som"]:
                return Response({"amount_som": ["Hisobingizda yetarli mablag' yo'q."]}, status=400)
            row = WithdrawalRequest.objects.create(
                writer=request.user, amount_som=amount, card_last4=card)
            AuditLog.objects.create(
                actor=request.user, action="withdrawal_request", target_type="withdrawal",
                target_id=str(row.pk), details={"amount_som": amount})
        return Response(_withdrawal_row(row), status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------- admin: moliya

def _month_start(now, back=0):
    first = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    for _ in range(back):
        first = (first - timedelta(days=1)).replace(day=1)
    return first


class AdminFinanceView(APIView):
    """GET /api/auth/admin/finance/ — moliya paneli (direktor, moliyachi)."""
    permission_classes = [IsFinanceStaff]

    def get(self, request):
        now = timezone.localtime()
        month = _month_start(now)
        orders = PaymentOrder.objects.filter(status=PaymentOrder.Status.PAID)
        splits = RevenueSplit.objects.all()
        paid = WithdrawalRequest.objects.filter(status="paid")
        pending = WithdrawalRequest.objects.filter(status="pending")

        def total(qs, field, **flt):
            return qs.filter(**flt).aggregate(s=Sum(field))["s"] or 0

        sold_all = total(orders, "amount_uzs")
        paid_all = total(paid, "amount_som")
        earned_all = total(splits, "writer_som")

        chart = []
        for back in range(5, -1, -1):
            start = _month_start(now, back)
            end = _month_start(now, back - 1) if back else now + timedelta(days=1)
            chart.append({
                "month": start.strftime("%Y-%m"),
                "in_som": total(orders, "amount_uzs", paid_at__gte=start, paid_at__lt=end),
                "out_som": total(paid, "amount_som", processed_at__gte=start,
                                 processed_at__lt=end),
            })

        events = []
        for o in orders.select_related("user").order_by("-paid_at")[:15]:
            events.append({"id": f"S{o.pk}", "kind": "purchase", "when": o.paid_at,
                           "user": o.user.full_name, "som": o.amount_uzs,
                           "label": f"Tanga sotib olindi ({o.coins}+{o.bonus_coins} tanga, "
                                    f"{o.get_provider_display()})"})
        for sp in splits.select_related("reader", "writer", "chapter", "chapter__book")[:15]:
            events.append({"id": f"B{sp.pk}", "kind": "split", "when": sp.created_at,
                           "user": sp.reader.full_name, "som": sp.gross_som,
                           "label": f"Bob ochildi: {sp.chapter.book.title}"})
        for w in paid.select_related("writer")[:15]:
            events.append({"id": f"W{w.pk}", "kind": "withdrawal", "when": w.processed_at,
                           "user": w.writer.full_name, "som": -w.amount_som,
                           "label": "Yozuvchiga to'lov"})
        events.sort(key=lambda e: e["when"], reverse=True)

        return Response({
            "rate_som": settings.COIN_RATE_SOM,
            "writer_percent": settings.WRITER_SHARE_PERCENT,
            "balance_som": sold_all - paid_all,
            "in_month_som": total(orders, "amount_uzs", paid_at__gte=month),
            "out_month_som": total(paid, "amount_som", processed_at__gte=month),
            "sold_total_som": sold_all,
            "unlocks_total_som": total(splits, "gross_som"),
            "platform_total_som": total(splits, "platform_som"),
            "platform_month_som": total(splits, "platform_som", created_at__gte=month),
            "writers_earned_som": earned_all,
            "writers_payable_som": earned_all - paid_all,
            "coins_in_wallets": Wallet.objects.aggregate(s=Sum("balance"))["s"] or 0,
            "coins_sold_month": (total(orders, "coins", paid_at__gte=month)
                                 + total(orders, "bonus_coins", paid_at__gte=month)),
            "coins_spent_month": total(splits, "coins", created_at__gte=month),
            "packs": [{"package": key, "count": orders.filter(
                package=key, paid_at__gte=month).count()} for key in PACKAGES],
            "pending_count": pending.count(),
            "pending_som": total(pending, "amount_som"),
            "chart": chart,
            "splits": [{
                "id": sp.id, "created_at": sp.created_at, "reader": sp.reader.full_name,
                "writer": sp.writer.full_name, "book": sp.chapter.book.title,
                "chapter": sp.chapter.title, "coins": sp.coins, "gross_som": sp.gross_som,
                "writer_som": sp.writer_som, "platform_som": sp.platform_som,
                "writer_percent": sp.writer_percent,
            } for sp in splits.select_related("reader", "writer", "chapter",
                                              "chapter__book")[:50]],
            "events": events[:30],
        })


class AdminWithdrawalListView(APIView):
    """GET /api/auth/admin/withdrawals/ — yozuvchilarning to'lov so'rovlari."""
    permission_classes = [IsFinanceStaff]

    def get(self, request):
        rows = WithdrawalRequest.objects.select_related("writer")[:200]
        return Response({
            "director_limit_som": settings.DIRECTOR_APPROVAL_SOM,
            "results": [{**_withdrawal_row(r), "writer": r.writer.full_name,
                         "writer_id": r.writer_id} for r in rows],
        })


class AdminWithdrawalActionView(APIView):
    """POST /api/auth/admin/withdrawals/<id>/  {"action": "approve" | "reject", "reason": "..."}"""
    permission_classes = [IsFinanceStaff]

    def post(self, request, pk):
        action = request.data.get("action")
        if action not in ("approve", "reject"):
            return Response({"detail": "Noma'lum amal."}, status=400)
        with transaction.atomic():
            row = get_object_or_404(WithdrawalRequest.objects.select_for_update(), pk=pk)
            if row.status != WithdrawalRequest.Status.PENDING:
                return Response({"detail": "Bu so'rov allaqachon ko'rib chiqilgan."}, status=409)
            if (action == "approve" and row.amount_som > settings.DIRECTOR_APPROVAL_SOM
                    and request.user.role != "direktor"):
                raise PermissionDenied("Bu summani faqat direktor tasdiqlaydi.")
            if action == "reject":
                reason = str(request.data.get("reason", "")).strip()[:200]
                if not reason:
                    return Response({"reason": ["Rad etish sababi majburiy."]}, status=400)
                row.status, row.reject_reason = WithdrawalRequest.Status.REJECTED, reason
            else:
                row.status = WithdrawalRequest.Status.PAID
            row.processed_by, row.processed_at = request.user, timezone.now()
            row.save()
            AuditLog.objects.create(
                actor=request.user, action=f"withdrawal_{action}", target_type="withdrawal",
                target_id=str(row.pk), details={"amount_som": row.amount_som,
                                                "writer_id": row.writer_id})
        return Response(_withdrawal_row(row))