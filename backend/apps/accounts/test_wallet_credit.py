from django.test import TestCase
from rest_framework.test import APIClient

from .models import AuditLog, User, Wallet

URL = "/api/auth/admin/wallet/credit/"


def make(email, role):
    return User.objects.create_user(
        email=email, password="SafePassword123!", full_name=email.split("@")[0], role=role)


class WalletCreditLimitTests(TestCase):
    def setUp(self):
        self.finance = make("fin@example.com", User.Role.MOLIYACHI)
        self.director = make("dir@example.com", User.Role.DIREKTOR)
        self.reader = make("reader@example.com", User.Role.READER)
        Wallet.objects.create(user=self.reader, balance=0)
        self.client = APIClient()

    def _credit(self, actor, user, amount, reference="Konkurs sovg'asi"):
        self.client.force_authenticate(actor)
        return self.client.post(
            URL, {"user_id": user.pk, "amount": amount, "reference": reference}, format="json")

    def test_finance_can_credit_small_amount_and_it_is_audited(self):
        r = self._credit(self.finance, self.reader, 10)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(Wallet.objects.get(user=self.reader).balance, 10)
        self.assertTrue(AuditLog.objects.filter(action="wallet_credit", actor=self.finance).exists())

    def test_finance_cannot_credit_above_limit(self):
        r = self._credit(self.finance, self.reader, 51)
        self.assertEqual(r.status_code, 403)
        self.assertEqual(Wallet.objects.get(user=self.reader).balance, 0)

    def test_director_can_credit_above_finance_limit(self):
        r = self._credit(self.director, self.reader, 500)
        self.assertEqual(r.status_code, 201)

    def test_nobody_can_exceed_absolute_cap(self):
        r = self._credit(self.director, self.reader, 1001)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(Wallet.objects.get(user=self.reader).balance, 0)

    def test_cannot_credit_own_wallet(self):
        self.assertEqual(self._credit(self.finance, self.finance, 5).status_code, 403)
        self.assertEqual(self._credit(self.director, self.director, 5).status_code, 403)

    def test_cannot_credit_deleted_or_inactive_user(self):
        self.reader.is_active = False
        self.reader.save()
        self.assertEqual(self._credit(self.director, self.reader, 5).status_code, 404)

    def test_reader_and_writer_cannot_use_endpoint(self):
        writer = make("w@example.com", User.Role.WRITER)
        self.assertEqual(self._credit(self.reader, self.reader, 5).status_code, 403)
        self.assertEqual(self._credit(writer, self.reader, 5).status_code, 403)

    def test_reference_is_required(self):
        r = self._credit(self.finance, self.reader, 5, reference="")
        self.assertEqual(r.status_code, 400)