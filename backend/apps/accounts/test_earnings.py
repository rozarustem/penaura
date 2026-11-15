from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import (RevenueSplit, User, Wallet, WalletTransaction,
                                  WithdrawalRequest)
from apps.payments.services import create_order, fulfill_order
from apps.catalog.models import Book, Chapter


def make_user(email, role):
    return User.objects.create_user(email=email, password="SafePassword123!",
                                    full_name=email.split("@")[0].title(), role=role)


def api(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


@override_settings(WRITER_SHARE_PERCENT=70, COIN_RATE_SOM=1500)
class SplitAndWithdrawalTests(TestCase):
    def setUp(self):
        self.reader = make_user("reader@example.com", User.Role.READER)
        self.writer = make_user("writer@example.com", User.Role.WRITER)
        self.fin = make_user("fin@example.com", User.Role.MOLIYACHI)
        self.director = make_user("dir@example.com", User.Role.DIREKTOR)
        book = Book.objects.create(author=self.writer, title="B", genre="fiction",
                                   status=Book.Status.PUBLISHED)
        self.chapter = Chapter.objects.create(book=book, title="C", content="x",
                                              status=Chapter.Status.PUBLISHED,
                                              is_premium=True, price=3)
        self.book = book
        Wallet.objects.create(user=self.reader, balance=100)

    def unlock(self):
        return api(self.reader).post(
            f"/api/books/{self.book.slug}/chapters/{self.chapter.pk}/unlock/", {}, format="json")

    def test_unlock_splits_70_30_immediately(self):
        self.assertEqual(self.unlock().status_code, 200)
        s = RevenueSplit.objects.get()
        self.assertEqual((s.gross_som, s.writer_som, s.platform_som), (4500, 3150, 1350))
        self.assertEqual(s.writer, self.writer)
        self.assertEqual(s.writer_som + s.platform_som, s.gross_som)

    def test_repeat_unlock_does_not_split_twice(self):
        self.unlock(); self.unlock()
        self.assertEqual(RevenueSplit.objects.count(), 1)

    def test_writer_sees_earnings_others_do_not(self):
        self.unlock()
        r = api(self.writer).get("/api/auth/earnings/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["earned_som"], 3150)
        self.assertEqual(len(r.data["splits"]), 1)
        self.assertEqual(api(self.reader).get("/api/auth/earnings/").status_code, 403)

    def add_earnings(self, som):
        RevenueSplit.objects.create(
            unlock=self._fake_unlock(), reader=self.reader, writer=self.writer,
            chapter=self.chapter, coins=1, rate_som=1500, writer_percent=70,
            gross_som=som, writer_som=som, platform_som=0)

    def _fake_unlock(self):
        from apps.accounts.models import ChapterUnlock
        w = Wallet.objects.get(user=self.reader)
        t = WalletTransaction.objects.create(wallet=w, kind="chapter_unlock", amount=1,
                                             balance_after=w.balance)
        other = Chapter.objects.create(book=self.book, title=f"X{ChapterUnlock.objects.count()}",
                                       content="x", status=Chapter.Status.PUBLISHED)
        return ChapterUnlock.objects.create(user=self.reader, chapter=other, transaction=t)

    def test_withdrawal_limits(self):
        self.add_earnings(100000)
        c = api(self.writer)
        post = lambda a, card="4417": c.post("/api/auth/earnings/withdraw/",
                                              {"amount_som": a, "card_last4": card}, format="json")
        self.assertEqual(post(500).status_code, 400)            # minimumdan kam
        self.assertEqual(post(10000, "12ab").status_code, 400)  # karta noto'g'ri
        self.assertEqual(post(100001).status_code, 400)         # balansdan ortiq
        self.assertEqual(post(60000).status_code, 201)
        self.assertEqual(post(60000).status_code, 400)          # kutilayotgani band qilgan
        self.assertEqual(c.get("/api/auth/earnings/").data["available_som"], 40000)

    def test_admin_approve_reject_and_director_limit(self):
        self.add_earnings(900000)
        big = WithdrawalRequest.objects.create(writer=self.writer, amount_som=800000, card_last4="4417")
        small = WithdrawalRequest.objects.create(writer=self.writer, amount_som=20000, card_last4="4417")
        fin, boss = api(self.fin), api(self.director)
        self.assertEqual(fin.post(f"/api/auth/admin/withdrawals/{big.pk}/", {"action": "approve"}, format="json").status_code, 403)
        self.assertEqual(boss.post(f"/api/auth/admin/withdrawals/{big.pk}/", {"action": "approve"}, format="json").status_code, 200)
        self.assertEqual(fin.post(f"/api/auth/admin/withdrawals/{small.pk}/", {"action": "reject"}, format="json").status_code, 400)
        self.assertEqual(fin.post(f"/api/auth/admin/withdrawals/{small.pk}/", {"action": "reject", "reason": "Rekvizit xato"}, format="json").status_code, 200)
        self.assertEqual(fin.post(f"/api/auth/admin/withdrawals/{small.pk}/", {"action": "approve"}, format="json").status_code, 409)
        # rad etilgan summa yana yechish uchun bo'sh
        self.assertEqual(api(self.writer).get("/api/auth/earnings/").data["available_som"], 100000)

    def test_finance_panel_shows_split_and_blocks_others(self):
        self.unlock()
        r = api(self.fin).get("/api/auth/admin/finance/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["platform_total_som"], 1350)
        self.assertEqual(r.data["writers_earned_som"], 3150)
        self.assertEqual(r.data["splits"][0]["platform_som"], 1350)
        self.assertEqual(api(self.writer).get("/api/auth/admin/finance/").status_code, 403)
        self.assertEqual(api(self.reader).get("/api/auth/admin/withdrawals/").status_code, 403)

    def test_finance_panel_counts_paid_orders_as_income(self):
        order = create_order(self.reader, "15", "mock")      # 25 000 so'm, 17 tanga
        create_order(self.reader, "5", "mock")                # to'lanmagan: hisobga olinmaydi
        fulfill_order(order.pk)
        r = api(self.fin).get("/api/auth/admin/finance/")
        self.assertEqual(r.data["in_month_som"], 25000)
        self.assertEqual(r.data["sold_total_som"], 25000)
        self.assertEqual(r.data["coins_sold_month"], 17)
        self.assertEqual(r.data["balance_som"], 25000)
        self.assertEqual(r.data["events"][0]["som"], 25000)