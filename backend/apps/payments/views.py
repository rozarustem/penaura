import logging

from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import click
from .models import PaymentOrder
from .services import PaymentError, create_order, fulfill_order

logger = logging.getLogger(__name__)


def _order_data(order, **extra):
    data = {
        "order_id": order.pk,
        "provider": order.provider,
        "status": order.status,
        "amount": order.amount_uzs,
        "coins": order.coins,
        "bonus": order.bonus_coins,
        "total_coins": order.total_coins,
    }
    data.update(extra)
    return data


class OrderCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        provider = str(request.data.get("provider", "")).lower()
        package = str(request.data.get("package", ""))

        if provider == PaymentOrder.Provider.MOCK and settings.PAYMENTS_MOCK_ENABLED:
            pass
        elif provider == PaymentOrder.Provider.CLICK:
            if not (settings.CLICK_SERVICE_ID and settings.CLICK_MERCHANT_ID and settings.CLICK_SECRET_KEY):
                return Response({"detail": "Click hali sozlanmagan."},
                                status=status.HTTP_503_SERVICE_UNAVAILABLE)
        elif provider == PaymentOrder.Provider.PAYME:
            return Response({"detail": "Payme hali ulanmagan. Hozircha Click'dan foydalaning."},
                            status=status.HTTP_501_NOT_IMPLEMENTED)
        else:
            return Response({"detail": "To'lov usuli noto'g'ri."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order = create_order(request.user, package, provider)
        except PaymentError as error:
            return Response({"detail": str(error)}, status=status.HTTP_400_BAD_REQUEST)

        pay_url = None
        if provider == PaymentOrder.Provider.CLICK:
            return_url = f"{settings.FRONTEND_URL.rstrip('/')}/coins.html?order={order.pk}"
            pay_url = click.build_pay_url(order, return_url)
        return Response(_order_data(order, pay_url=pay_url), status=status.HTTP_201_CREATED)


class OrderDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        order = get_object_or_404(PaymentOrder, pk=pk, user=request.user)
        return Response(_order_data(order))


class MockPayView(APIView):
    """Faqat lokal sinov uchun (DEBUG + PAYMENTS_MOCK=True). Production'da 404 qaytaradi."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        if not settings.PAYMENTS_MOCK_ENABLED:
            return Response(status=status.HTTP_404_NOT_FOUND)
        order = get_object_or_404(PaymentOrder, pk=pk, user=request.user,
                                  provider=PaymentOrder.Provider.MOCK)
        order, _ = fulfill_order(order.pk)
        return Response(_order_data(order))


@csrf_exempt
@require_POST
def click_callback(request):
    data = {key: value for key, value in request.POST.items()}
    try:
        return JsonResponse(click.handle(data))
    except Exception:
        logger.exception("Click callback xatosi")
        return JsonResponse({"error": click.UPDATE_FAILED, "error_note": click.NOTES[click.UPDATE_FAILED]})
