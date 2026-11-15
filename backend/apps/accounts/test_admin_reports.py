from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.catalog.models import Book, Chapter
from apps.payments.services import create_order, fulfill_order

from .models import User, Wallet, WalletTransaction

SALES = "/api/auth/admin/coin-sales/"
REPORTS = "/api/auth/admin/reports/"


def make(email, role):
    return User.objects.create_user(
        email=email, password="SafePassword123!", full_name=email.split("@")[0], role=role)


class AdminReportsTests(TestCase):
    def setUp(self):
        self.finance = make("fin@example.com", User.Role.MOLIYACHI)
        self.reader = make("reader@example.com", User.Role.READER)
        self.writer = make("writer@example.com", User.Role.WRITER)
        self.client = APIClient()
        self.client.force_authenticate(self.finance)

    def _buy(self, package="15", provider="click"):
        order = create_order(self.reader, package, provider)
        fulfill_order(order.pk)
        return order

    def _unlock_one_chapter(self):
        book = Book.objects.create(author=self.writer, title="B", genre="fiction",
                                   status=Book.Status.PUBLISHED)
        ch = Chapter.objects.create(book=book, title="C", content="<p>x</p>", order=1,
                                    is_premium=True, price=5, status=Chapter.Status.PUBLISHED)
        reader = APIClient()
        reader.force_authenticate(self.reader)
        r = reader.post(f"/api/books/{book.slug}/chapters/{ch.pk}/unlock/")
        self.assertEqual(r.status_code, 200)

    def test_only_finance_staff_can_read(self):
        for user in (self.reader, self.writer, make("m@example.com", User.Role.MODERATOR),
                     make("t@example.com", User.Role.TAHRIRCHI)):
            c = APIClient()
            c.force_authenticate(user)
            self.assertEqual(c.get(SALES).status_code, 403, user.role)
            self.assertEqual(c.get(REPORTS).status_code, 403, user.role)
        self.assertEqual(APIClient().get(REPORTS).status_code, 401)
        director = APIClient()
        director.force_authenticate(make("d@example.com", User.Role.DIREKTOR))
        self.assertEqual(director.get(SALES).status_code, 200)

    def test_empty_system_is_consistent(self):
        r = self.client.get(REPORTS)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["mismatches"], 0)
        self.assertEqual(len(r.data["months"]), 6)

    def test_coin_sales_shows_real_packages_and_purchases(self):
        self._buy("15")
        self._buy("15")
        self._buy("5")
        r = self.client.get(SALES)
        pk = {p["package"]: p for p in r.data["packages"]}
        self.assertEqual(pk["15"]["sold_month"], 2)
        self.assertEqual(pk["15"]["price_som"], 25000)
        self.assertEqual(pk["15"]["bonus"], 2)
        self.assertEqual(pk["15"]["revenue_month_som"], 50000)
        self.assertEqual(pk["5"]["sold_month"], 1)
        self.assertEqual(pk["100"]["sold_month"], 0)
        self.assertEqual(r.data["orders_month"], 3)
        self.assertEqual(r.data["revenue_month_som"], 60000)
        self.assertEqual(r.data["coins_sold_month"], 17 + 17 + 5)
        self.assertEqual(len(r.data["purchases"]), 3)

    def test_unpaid_orders_do_not_count_as_sales(self):
        create_order(self.reader, "40", "click")  # to'lanmagan
        r = self.client.get(SALES)
        self.assertEqual(r.data["orders_month"], 0)
        self.assertEqual(r.data["revenue_month_som"], 0)
        self.assertEqual(r.data["unfinished_orders"], 1)

    def test_test_payments_are_reported_separately(self):
        self._buy("5", provider="mock")
        r = self.client.get(SALES)
        self.assertEqual(r.data["mock_paid_count"], 1)
        self.assertEqual(r.data["mock_paid_som"], 10000)

    def test_full_flow_keeps_all_checks_ok(self):
        self._buy("15")
        self._unlock_one_chapter()
        r = self.client.get(REPORTS)
        self.assertEqual(r.data["mismatches"], 0, r.data["checks"])
        self.assertEqual(r.data["sold_total_som"], 25000)
        self.assertEqual(r.data["unlocks_total_som"], 5 * 1500)
        self.assertEqual(r.data["writers_earned_som"], 5 * 1500 * 70 // 100)
        self.assertEqual(r.data["platform_total_som"], 7500 - 5250)
        current = r.data["months"][-1]
        self.assertEqual(current["sold_som"], 25000)
        self.assertEqual(current["unlocks"], 1)

    def test_tampered_wallet_balance_is_detected(self):
        self._buy("15")
        Wallet.objects.filter(user=self.reader).update(balance=999)
        r = self.client.get(REPORTS)
        self.assertEqual(r.data["mismatches"], 1)
        bad = next(c for c in r.data["checks"] if not c["ok"])
        self.assertEqual(bad["key"], "wallet_balance")
        self.assertEqual(bad["expected"], 17)
        self.assertEqual(bad["actual"], 999)
        self.assertEqual(bad["diff"], 982)

    def test_coins_without_matching_order_are_detected(self):
        wallet = Wallet.objects.get_or_create(user=self.reader)[0]
        wallet.balance = 10
        wallet.save()
        WalletTransaction.objects.create(wallet=wallet, kind="purchase", amount=10,
                                         balance_after=10, reference="qo'lda")
        r = self.client.get(REPORTS)
        keys = [c["key"] for c in r.data["checks"] if not c["ok"]]
        self.assertEqual(keys, ["orders_vs_wallet"])


class AdminSystemSettingsTests(TestCase):
    URL = "/api/auth/admin/system-settings/"

    def _client(self, role):
        c = APIClient()
        c.force_authenticate(make(f"{role}@example.com", role))
        return c

    @override_settings(WRITER_SHARE_PERCENT=65, COIN_RATE_SOM=2000, MIN_WITHDRAWAL_SOM=20000,
                       DIRECTOR_APPROVAL_SOM=900000)
    def test_returns_current_values(self):
        r = self._client(User.Role.MOLIYACHI).get(self.URL)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["writer_percent"], 65)
        self.assertEqual(r.data["rate_som"], 2000)
        self.assertEqual(r.data["min_withdrawal_som"], 20000)
        self.assertEqual(r.data["director_approval_som"], 900000)

    @override_settings(CLICK_SERVICE_ID="111", CLICK_MERCHANT_ID="222", CLICK_SECRET_KEY="supersecretvalue")
    def test_secrets_are_never_returned(self):
        r = self._client(User.Role.DIREKTOR).get(self.URL)
        self.assertTrue(r.data["click_configured"])
        self.assertNotIn("supersecretvalue", r.content.decode())

    @override_settings(CLICK_SERVICE_ID="", CLICK_MERCHANT_ID="", CLICK_SECRET_KEY="")
    def test_click_not_configured(self):
        r = self._client(User.Role.MOLIYACHI).get(self.URL)
        self.assertFalse(r.data["click_configured"])
        self.assertFalse(r.data["payme_connected"])

    def test_only_finance_staff(self):
        for role in (User.Role.READER, User.Role.WRITER, User.Role.MODERATOR, User.Role.TAHRIRCHI):
            self.assertEqual(self._client(role).get(self.URL).status_code, 403, role)
        self.assertEqual(APIClient().get(self.URL).status_code, 401)