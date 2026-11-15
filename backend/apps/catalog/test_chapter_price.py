from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import User, Wallet
from .models import Book, Chapter


class ChapterPriceTests(TestCase):
    def setUp(self):
        self.writer = User.objects.create_user(
            email="writer@example.com", password="SafePassword123!",
            full_name="Writer", role=User.Role.WRITER,
        )
        self.reader = User.objects.create_user(
            email="reader@example.com", password="SafePassword123!",
            full_name="Reader", role=User.Role.READER,
        )
        Wallet.objects.create(user=self.reader, balance=100)
        self.book = Book.objects.create(
            author=self.writer, title="Book", genre="fiction", status=Book.Status.PUBLISHED,
        )
        self.chapter = Chapter.objects.create(
            book=self.book, title="Ch", content="<p>x</p>", order=1, is_premium=True,
            price=5, status=Chapter.Status.DRAFT,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.writer)
        self.url = f"/api/books/{self.book.slug}/chapters/{self.chapter.pk}/"

    def _unlock(self):
        self.chapter.status = Chapter.Status.PUBLISHED
        self.chapter.save()
        reader = APIClient()
        reader.force_authenticate(self.reader)
        r = reader.post(f"/api/books/{self.book.slug}/chapters/{self.chapter.pk}/unlock/")
        self.assertEqual(r.status_code, 200)

    def test_price_zero_rejected(self):
        r = self.client.patch(self.url, {"price": 0}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("price", r.data)

    def test_price_too_high_rejected(self):
        r = self.client.patch(self.url, {"price": 30000}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_price_within_range_allowed_before_any_sale(self):
        r = self.client.patch(self.url, {"price": 20}, format="json")
        self.assertEqual(r.status_code, 200)
        self.chapter.refresh_from_db()
        self.assertEqual(self.chapter.price, 20)

    def test_new_chapter_price_validated(self):
        r = self.client.post(f"/api/books/{self.book.slug}/chapters/",
                             {"title": "N", "content": "<p>a</p>", "is_premium": True, "price": 999},
                             format="json")
        self.assertEqual(r.status_code, 400)

    def test_price_locked_after_purchase(self):
        self._unlock()
        r = self.client.patch(self.url, {"price": 1}, format="json")
        self.assertEqual(r.status_code, 400)
        self.chapter.refresh_from_db()
        self.assertEqual(self.chapter.price, 5)

    def test_premium_flag_locked_after_purchase(self):
        self._unlock()
        r = self.client.patch(self.url, {"is_premium": False}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_sending_same_price_after_purchase_is_fine(self):
        """Frontend har saqlashda is_premium yuboradi; o'zgarmagan bo'lsa xato bo'lmasligi kerak."""
        self._unlock()
        r = self.client.patch(self.url, {"is_premium": True, "price": 5, "title": "Ch"}, format="json")
        self.assertEqual(r.status_code, 200)