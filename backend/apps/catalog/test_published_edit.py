from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import User
from .models import Book, Chapter, Poem


class PublishedEditGoesBackToReviewTests(TestCase):
    """Nashr qilingan bob/she'r matni yozuvchi tomonidan o'zgartirilsa, tahririyatga qaytadi."""

    def setUp(self):
        self.writer = User.objects.create_user(
            email="writer@example.com", password="SafePassword123!",
            full_name="Writer", role=User.Role.WRITER,
        )
        self.other = User.objects.create_user(
            email="other@example.com", password="SafePassword123!",
            full_name="Other", role=User.Role.WRITER,
        )
        self.book = Book.objects.create(
            author=self.writer, title="Book", genre="fiction", status=Book.Status.PUBLISHED,
        )
        self.chapter = Chapter.objects.create(
            book=self.book, title="Ch", content="<p>orig</p>", order=1,
            status=Chapter.Status.PUBLISHED, published_at=timezone.now(),
        )
        self.poem = Poem.objects.create(
            author=self.writer, title="Poem", content="<p>orig</p>",
            status=Poem.Status.PUBLISHED, published_at=timezone.now(),
        )
        self.client = APIClient()
        self.client.force_authenticate(self.writer)
        self.chapter_url = f"/api/books/{self.book.slug}/chapters/{self.chapter.pk}/"
        self.poem_url = f"/api/poems/{self.poem.slug}/"

    def test_editing_published_chapter_content_sends_it_to_review(self):
        response = self.client.patch(self.chapter_url, {"content": "<p>new</p>"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.chapter.refresh_from_db()
        self.assertEqual(self.chapter.status, Chapter.Status.SUBMITTED)
        self.assertIsNone(self.chapter.published_at)
        self.assertIsNotNone(self.chapter.submitted_at)
        self.assertEqual(response.data["status"], "submitted")

    def test_editing_published_chapter_title_sends_it_to_review(self):
        self.client.patch(self.chapter_url, {"title": "New title"}, format="json")
        self.chapter.refresh_from_db()
        self.assertEqual(self.chapter.status, Chapter.Status.SUBMITTED)

    def test_unchanged_chapter_content_stays_published(self):
        self.client.patch(self.chapter_url, {"content": "<p>orig</p>", "title": "Ch"}, format="json")
        self.chapter.refresh_from_db()
        self.assertEqual(self.chapter.status, Chapter.Status.PUBLISHED)

    def test_edited_chapter_is_hidden_from_public_until_republished(self):
        self.client.patch(self.chapter_url, {"content": "<p>new</p>"}, format="json")
        anon = APIClient()
        self.assertEqual(anon.get(self.chapter_url).status_code, 404)

    def test_explicit_draft_still_unpublishes_chapter(self):
        self.client.patch(self.chapter_url, {"status": "draft"}, format="json")
        self.chapter.refresh_from_db()
        self.assertEqual(self.chapter.status, Chapter.Status.DRAFT)

    def test_unfinished_chapter_keeps_its_status_on_edit(self):
        self.chapter.status = Chapter.Status.DRAFT
        self.chapter.save()
        self.client.patch(self.chapter_url, {"content": "<p>new</p>"}, format="json")
        self.chapter.refresh_from_db()
        self.assertEqual(self.chapter.status, Chapter.Status.DRAFT)

    def test_editing_published_poem_sends_it_to_review(self):
        response = self.client.patch(self.poem_url, {"content": "<p>new</p>"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.poem.refresh_from_db()
        self.assertEqual(self.poem.status, Poem.Status.SUBMITTED)
        self.assertIsNone(self.poem.published_at)
        self.assertIsNotNone(self.poem.submitted_at)

    def test_edited_poem_is_hidden_from_public_until_republished(self):
        self.client.patch(self.poem_url, {"title": "Changed"}, format="json")
        self.assertEqual(APIClient().get(self.poem_url).status_code, 404)

    def test_unchanged_poem_stays_published(self):
        self.client.patch(self.poem_url, {"title": "Poem", "content": "<p>orig</p>"}, format="json")
        self.poem.refresh_from_db()
        self.assertEqual(self.poem.status, Poem.Status.PUBLISHED)

    def test_other_writer_still_cannot_edit(self):
        other = APIClient()
        other.force_authenticate(self.other)
        self.assertEqual(other.patch(self.chapter_url, {"content": "x"}, format="json").status_code, 403)
        self.assertEqual(other.patch(self.poem_url, {"content": "x"}, format="json").status_code, 403)