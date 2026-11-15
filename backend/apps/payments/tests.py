from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import User, Wallet, WalletTransaction

from . import click
from .models import PaymentOrder
from .services import create_order

CLICK = dict(CLICK_SERVICE_ID="111", CLICK_MERCHANT_ID="222", CLICK_SECRET_KEY="secret")


def signed(order, action, trans_id="9001", prepare_id=None, amount=None, error="0"):
    data = {
        "click_trans_id": trans_id,
        "service_id": "111",
        "click_paydoc_id": "5",
        "merchant_trans_id": str(order.pk),
        "amount": str(amount if amount is not None else f"{order.amount_uzs}.0"),
        "action": str(action),
        "error": error,
        "error_note": "Success",
        "sign_time": "2026-10-28 12:00:00",
    }
    if action == 1:
        data["merchant_prepare_id"] = str(prepare_id if prepare_id is not None else order.pk)
    data["sign_string"] = click.make_sign(data, complete=(action == 1))
    return data


@override_settings(**CLICK)
class ClickFlowTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("buyer@example.com", "SafePassword123!", full_name="Buyer")
        self.order = create_order(self.user, "15", "click")  # 15 + 2 bonus = 17 tanga, 25000 so'm

    def balance(self):
        return Wallet.objects.get(user=self.user).balance

    def test_full_payment_credits_coins_once(self):
        prepared = click.handle(signed(self.order, 0))
        self.assertEqual(prepared["error"], 0)
        self.assertEqual(prepared["merchant_prepare_id"], self.order.pk)

        done = click.handle(signed(self.order, 1))
        self.assertEqual(done["error"], 0)
        self.assertEqual(self.balance(), 17)

        again = click.handle(signed(self.order, 1))
        self.assertEqual(again["error"], click.ALREADY_PAID)
        self.assertEqual(self.balance(), 17)
        self.assertEqual(WalletTransaction.objects.filter(kind="purchase").count(), 1)

    def test_bad_signature_is_rejected(self):
        data = signed(self.order, 0)
        data["sign_string"] = "0" * 32
        self.assertEqual(click.handle(data)["error"], click.SIGN_FAILED)

    def test_wrong_amount_is_rejected(self):
        data = signed(self.order, 0, amount="1000.0")
        self.assertEqual(click.handle(data)["error"], click.INCORRECT_AMOUNT)

    def test_unknown_order(self):
        self.order.pk = 999999
        self.assertEqual(click.handle(signed(self.order, 0))["error"], click.ORDER_NOT_FOUND)

    def test_complete_without_prepare_is_rejected(self):
        self.assertEqual(click.handle(signed(self.order, 1))["error"], click.TRANSACTION_NOT_FOUND)
        self.assertEqual(self.balance() if Wallet.objects.filter(user=self.user).exists() else 0, 0)

    def test_cancelled_by_click(self):
        click.handle(signed(self.order, 0))
        result = click.handle(signed(self.order, 1, error="-5017"))
        self.assertEqual(result["error"], click.CANCELLED)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, PaymentOrder.Status.CANCELLED)
        self.assertEqual(click.handle(signed(self.order, 1))["error"], click.CANCELLED)

    def test_unknown_action(self):
        data = signed(self.order, 0)
        data["action"] = "7"
        data["sign_string"] = click.make_sign(data, complete=False)
        self.assertEqual(click.handle(data)["error"], click.ACTION_NOT_FOUND)


@override_settings(**CLICK, PAYMENTS_MOCK_ENABLED=False)
class OrderApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("api@example.com", "SafePassword123!", full_name="Api")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_requires_login(self):
        response = APIClient().post("/api/payments/orders/", {"package": "5", "provider": "click"}, format="json")
        self.assertEqual(response.status_code, 401)

    def test_price_comes_from_server(self):
        response = self.client.post("/api/payments/orders/",
                                    {"package": "5", "provider": "click", "price": 1}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["amount"], 10000)
        self.assertIn("my.click.uz/services/pay", response.data["pay_url"])

    def test_unknown_package_and_provider(self):
        bad_package = self.client.post("/api/payments/orders/", {"package": "999", "provider": "click"}, format="json")
        self.assertEqual(bad_package.status_code, 400)
        bad_provider = self.client.post("/api/payments/orders/", {"package": "5", "provider": "visa"}, format="json")
        self.assertEqual(bad_provider.status_code, 400)

    def test_mock_provider_is_disabled_by_default(self):
        response = self.client.post("/api/payments/orders/", {"package": "5", "provider": "mock"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_cannot_read_other_users_order(self):
        order = create_order(self.user, "5", "click")
        other = User.objects.create_user("other@example.com", "SafePassword123!", full_name="Other")
        client = APIClient()
        client.force_authenticate(other)
        self.assertEqual(client.get(f"/api/payments/orders/{order.pk}/").status_code, 404)


@override_settings(**CLICK, PAYMENTS_MOCK_ENABLED=True)
class MockPaymentTests(TestCase):
    def test_mock_payment_credits_wallet(self):
        user = User.objects.create_user("mock@example.com", "SafePassword123!", full_name="Mock")
        client = APIClient()
        client.force_authenticate(user)
        order = client.post("/api/payments/orders/", {"package": "40", "provider": "mock"}, format="json").data
        client.post(f"/api/payments/orders/{order['order_id']}/mock-pay/")
        client.post(f"/api/payments/orders/{order['order_id']}/mock-pay/")  # takror - qo'shilmaydi
        self.assertEqual(Wallet.objects.get(user=user).balance, 48)
