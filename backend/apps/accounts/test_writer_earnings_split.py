from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.catalog.models import Book, Chapter
from apps.payments.services import create_order, fulfill_order

from .models import User, Wallet


def make(email, role):
    return User.objects.create_user(email=email, password="SafePassword123!",
                                    full_name=email.split("@")[0], role=role)


@override_settings(WRITER_SHARE_PERCENT=70, COIN_RATE_SOM=1500)
class WriterEarningsSplitTests(TestCase):
    def setUp(self):
        self.writer = make("writer@example.com", User.Role.WRITER)
        self.reader = make("reader@example.com", User.Role.READER)
        self.book = Book.objects.create(author=self.writer, title="B", genre="fiction",
                                        status=Book.Status.PUBLISHED)
        Wallet.objects.get_or_create(user=self.reader)
        fulfill_order(create_order(self.reader, "15", "click").pk)

    def _unlock(self, price):
        ch = Chapter.objects.create(book=self.book, title=f"C{price}", content="<p>x</p>",
                                    order=price, is_premium=True, price=price,
                                    status=Chapter.Status.PUBLISHED)
        c = APIClient()
        c.force_authenticate(self.reader)
        self.assertEqual(c.post(f"/api/books/{self.book.slug}/chapters/{ch.pk}/unlock/").status_code, 200)

    def _earnings(self):
        c = APIClient()
        c.force_authenticate(self.writer)
        return c.get("/api/auth/earnings/").data

    def test_one_coin_is_split_1050_to_writer_450_to_platform(self):
        self._unlock(1)
        d = self._earnings()
        self.assertEqual(d["writer_percent"], 70)
        self.assertEqual(d["rate_som"], 1500)
        self.assertEqual(d["gross_som"], 1500)
        self.assertEqual(d["earned_som"], 1050)
        self.assertEqual(d["platform_som"], 450)
        row = d["splits"][0]
        self.assertEqual((row["gross_som"], row["writer_som"], row["platform_som"]), (1500, 1050, 450))

    def test_totals_add_up_over_several_unlocks(self):
        self._unlock(1)
        self._unlock(3)
        d = self._earnings()
        self.assertEqual(d["gross_som"], 4 * 1500)
        self.assertEqual(d["earned_som"] + d["platform_som"], d["gross_som"])
        self.assertEqual(d["earned_som"], 4200)
        self.assertEqual(d["platform_som"], 1800)

    def test_no_sales_gives_zero_totals(self):
        d = self._earnings()
        self.assertEqual((d["gross_som"], d["platform_som"], d["earned_som"]), (0, 0, 0))

    def test_writer_sees_only_own_totals(self):
        self._unlock(1)
        other = make("other@example.com", User.Role.WRITER)
        c = APIClient()
        c.force_authenticate(other)
        d = c.get("/api/auth/earnings/").data
        self.assertEqual((d["gross_som"], d["platform_som"]), (0, 0))