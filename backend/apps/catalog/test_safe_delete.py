from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import ChapterUnlock, RevenueSplit, User, Wallet
from .models import Book, Chapter


class SafeDeleteTests(TestCase):
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
        self.paid = Chapter.objects.create(
            book=self.book, title="Paid", content="<p>x</p>", order=1, is_premium=True,
            price=5, status=Chapter.Status.PUBLISHED,
        )
        self.free = Chapter.objects.create(
            book=self.book, title="Free", content="<p>y</p>", order=2,
            status=Chapter.Status.PUBLISHED,
        )
        self.writer_client = APIClient()
        self.writer_client.force_authenticate(self.writer)

    def _buy(self):
        reader = APIClient()
        reader.force_authenticate(self.reader)
        r = reader.post(f"/api/books/{self.book.slug}/chapters/{self.paid.pk}/unlock/")
        self.assertEqual(r.status_code, 200)

    def test_purchased_chapter_cannot_be_deleted_returns_409(self):
        self._buy()
        r = self.writer_client.delete(f"/api/books/{self.book.slug}/chapters/{self.paid.pk}/")
        self.assertEqual(r.status_code, 409)
        self.assertIn("detail", r.data)
        self.assertTrue(Chapter.objects.filter(pk=self.paid.pk).exists())
        self.assertEqual(RevenueSplit.objects.count(), 1)

    def test_book_with_purchased_chapter_cannot_be_deleted_and_nothing_is_lost(self):
        self._buy()
        r = self.writer_client.delete(f"/api/books/{self.book.slug}/")
        self.assertEqual(r.status_code, 409)
        self.assertTrue(Book.objects.filter(pk=self.book.pk).exists())
        self.assertTrue(Chapter.objects.filter(pk=self.free.pk).exists())  # qisman o'chmagan
        self.assertEqual(ChapterUnlock.objects.count(), 1)

    def test_unpurchased_chapter_can_be_deleted(self):
        self._buy()
        r = self.writer_client.delete(f"/api/books/{self.book.slug}/chapters/{self.free.pk}/")
        self.assertEqual(r.status_code, 204)
        self.assertFalse(Chapter.objects.filter(pk=self.free.pk).exists())

    def test_book_without_sales_can_be_deleted(self):
        r = self.writer_client.delete(f"/api/books/{self.book.slug}/")
        self.assertEqual(r.status_code, 204)
        self.assertFalse(Book.objects.filter(pk=self.book.pk).exists())

    def test_only_owner_can_delete(self):
        other = User.objects.create_user(
            email="o@example.com", password="SafePassword123!", full_name="O", role=User.Role.WRITER)
        c = APIClient()
        c.force_authenticate(other)
        self.assertEqual(c.delete(f"/api/books/{self.book.slug}/").status_code, 403)