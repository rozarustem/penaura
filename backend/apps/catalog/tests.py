from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import AuditLog, ChapterUnlock, User, Wallet, WalletTransaction
from .models import Book, Chapter, Poem, PoemBookmark, PoemRating


class ChapterUnlockTests(TestCase):
    def setUp(self):
        self.reader = User.objects.create_user(
            email="reader@example.com", password="SafePassword123!",
            full_name="Reader", role=User.Role.READER,
        )
        self.writer = User.objects.create_user(
            email="writer@example.com", password="SafePassword123!",
            full_name="Writer", role=User.Role.WRITER,
        )
        self.book = Book.objects.create(
            author=self.writer, title="Test Book", genre="fiction",
            status=Book.Status.PUBLISHED,
        )
        self.chapter = Chapter.objects.create(
            book=self.book, title="Premium Chapter", content="Chapter body",
            status=Chapter.Status.PUBLISHED, is_premium=True, price=3,
        )
        self.wallet = Wallet.objects.create(user=self.reader, balance=10)
        self.client = APIClient()
        self.client.force_authenticate(self.reader)

    def test_unlock_charges_once_and_exposes_content(self):
        url = f"/api/books/{self.book.slug}/chapters/{self.chapter.pk}/unlock/"
        response = self.client.post(url, {}, format="json")
        self.assertEqual(response.status_code, 200)
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, 7)
        self.assertEqual(WalletTransaction.objects.filter(wallet=self.wallet).count(), 1)
        self.assertEqual(ChapterUnlock.objects.filter(user=self.reader).count(), 1)

        second = self.client.post(url, {}, format="json")
        self.assertTrue(second.data["already_unlocked"])
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, 7)

        chapter_response = self.client.get(
            f"/api/books/{self.book.slug}/chapters/{self.chapter.pk}/"
        )
        self.assertEqual(chapter_response.data["content"], "Chapter body")

    def test_insufficient_balance_does_not_create_transaction(self):
        self.wallet.balance = 2
        self.wallet.save(update_fields=["balance"])
        response = self.client.post(
            f"/api/books/{self.book.slug}/chapters/{self.chapter.pk}/unlock/",
            {}, format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.wallet.refresh_from_db()
        self.assertEqual(self.wallet.balance, 2)
        self.assertFalse(WalletTransaction.objects.exists())
        self.assertFalse(ChapterUnlock.objects.exists())


class EditorialWorkflowTests(TestCase):
    def setUp(self):
        self.writer = User.objects.create_user(
            email="writer@example.com", password="SafePassword123!",
            full_name="Writer", role=User.Role.WRITER,
        )
        self.editor = User.objects.create_user(
            email="editor@example.com", password="SafePassword123!",
            full_name="Editor", role=User.Role.TAHRIRCHI,
        )
        self.book = Book.objects.create(
            author=self.writer, title="Submitted Book", genre="fiction",
        )
        self.chapter = Chapter.objects.create(
            book=self.book, title="Submitted Chapter", content="<p>Text</p>",
            status=Chapter.Status.SUBMITTED,
        )
        self.client = APIClient()

    def test_only_editorial_staff_can_claim_and_publish(self):
        self.client.force_authenticate(self.writer)
        denied = self.client.post(
            f"/api/editorial/books/{self.book.pk}/action/",
            {"action": "claim"}, format="json",
        )
        self.assertEqual(denied.status_code, 403)

        self.client.force_authenticate(self.editor)
        claimed = self.client.post(
            f"/api/editorial/books/{self.book.pk}/action/",
            {"action": "claim"}, format="json",
        )
        self.assertEqual(claimed.status_code, 200)
        self.chapter.refresh_from_db()
        self.assertEqual(self.chapter.status, Chapter.Status.EDITING)

        published = self.client.post(
            f"/api/editorial/books/{self.book.pk}/action/",
            {"action": "publish"}, format="json",
        )
        self.assertEqual(published.status_code, 200)
        self.chapter.refresh_from_db()
        self.book.refresh_from_db()
        self.assertEqual(self.chapter.status, Chapter.Status.PUBLISHED)
        self.assertEqual(self.book.status, Book.Status.PUBLISHED)

    def test_writer_can_submit_poem_but_cannot_publish_it(self):
        self.client.force_authenticate(self.writer)
        response = self.client.post("/api/poems/", {
            "title": "Test Poem", "content": "<p>Text</p>", "status": "submitted",
        }, format="json")
        self.assertEqual(response.status_code, 201)
        poem = Poem.objects.get()
        self.assertEqual(poem.status, Poem.Status.SUBMITTED)
        self.assertEqual(response.data["content"], "<p>Text</p>")


class PoemActivityTests(TestCase):
    """She'rga baho va Bookmark endi serverda saqlanadi (brauzerda emas)."""

    def setUp(self):
        mk = User.objects.create_user
        self.writer = mk(email="w@example.com", password="SafePassword123!",
                         full_name="Writer", role=User.Role.WRITER)
        self.reader1 = mk(email="r1@example.com", password="SafePassword123!",
                          full_name="R1", role=User.Role.READER)
        self.reader2 = mk(email="r2@example.com", password="SafePassword123!",
                          full_name="R2", role=User.Role.READER)
        self.poem = Poem.objects.create(
            author=self.writer, title="Bahor", content="matn",
            status=Poem.Status.PUBLISHED)
        self.draft = Poem.objects.create(
            author=self.writer, title="Qoralama", content="matn",
            status=Poem.Status.DRAFT)
        self.client = APIClient()

    def rate(self, user, value, poem=None):
        self.client.force_authenticate(user)
        return self.client.put(f"/api/poems/{(poem or self.poem).slug}/rating/",
                               {"value": value}, format="json")

    def test_anonymous_cannot_rate_bookmark_or_read_activity(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.put(f"/api/poems/{self.poem.slug}/rating/",
                                         {"value": 5}, format="json").status_code, 401)
        self.assertEqual(self.client.post(f"/api/poems/{self.poem.slug}/bookmark/").status_code, 401)
        self.assertEqual(self.client.get("/api/poems/activity/").status_code, 401)

    def test_rating_is_saved_changed_and_averaged(self):
        self.assertEqual(self.rate(self.reader1, 4).status_code, 200)
        res = self.rate(self.reader2, 5)
        self.assertEqual(res.data["rating"], 4.5)
        self.assertEqual(res.data["ratings_count"], 2)
        # qayta baholash — yangi yozuv emas, mavjudi o'zgaradi
        res = self.rate(self.reader1, 2)
        self.assertEqual(PoemRating.objects.filter(poem=self.poem).count(), 2)
        self.assertEqual(res.data["rating"], 3.5)
        self.poem.refresh_from_db()
        self.assertEqual(self.poem.rating, 3.5)

    def test_invalid_rating_values_rejected(self):
        for bad in (0, 6, -1, "abc", None):
            self.assertEqual(self.rate(self.reader1, bad).status_code, 400, bad)
        self.assertFalse(PoemRating.objects.exists())

    def test_author_cannot_rate_own_poem(self):
        self.assertEqual(self.rate(self.writer, 5).status_code, 400)

    def test_cannot_rate_unpublished_or_hidden_poem(self):
        self.assertEqual(self.rate(self.reader1, 5, self.draft).status_code, 404)
        self.poem.is_hidden = True
        self.poem.save()
        self.assertEqual(self.rate(self.reader1, 5).status_code, 404)

    def test_delete_rating_recalculates(self):
        self.rate(self.reader1, 4)
        self.rate(self.reader2, 2)
        self.client.force_authenticate(self.reader1)
        res = self.client.delete(f"/api/poems/{self.poem.slug}/rating/")
        self.assertEqual(res.data["rating"], 2.0)
        self.client.force_authenticate(self.reader2)
        res = self.client.delete(f"/api/poems/{self.poem.slug}/rating/")
        self.assertEqual(res.data["rating"], 0)

    def test_bookmark_toggles(self):
        self.client.force_authenticate(self.reader1)
        url = f"/api/poems/{self.poem.slug}/bookmark/"
        self.assertTrue(self.client.post(url).data["bookmarked"])
        self.assertEqual(PoemBookmark.objects.count(), 1)
        self.assertFalse(self.client.post(url).data["bookmarked"])
        self.assertEqual(PoemBookmark.objects.count(), 0)

    def test_activity_returns_only_own_data(self):
        self.rate(self.reader1, 4)
        self.rate(self.reader2, 1)
        self.client.force_authenticate(self.reader1)
        self.client.post(f"/api/poems/{self.poem.slug}/bookmark/")
        data = self.client.get("/api/poems/activity/").data
        self.assertEqual(data["ratings"], {str(self.poem.id): 4})
        self.assertEqual(data["bookmarks"], [self.poem.id])
        self.client.force_authenticate(self.reader2)
        data = self.client.get("/api/poems/activity/").data
        self.assertEqual(data["ratings"], {str(self.poem.id): 1})
        self.assertEqual(data["bookmarks"], [])


class ShowcaseTests(TestCase):
    """Tanlangan asarlar va oy muallifi: faqat tahririyat xodimlari boshqaradi."""

    def setUp(self):
        mk = User.objects.create_user
        self.director = mk(email="d@example.com", password="x-Pass-12345", full_name="Dir", role=User.Role.DIREKTOR)
        self.editor = mk(email="e@example.com", password="x-Pass-12345", full_name="Ed", role=User.Role.TAHRIRCHI)
        self.moderator = mk(email="m@example.com", password="x-Pass-12345", full_name="Mod", role=User.Role.MODERATOR)
        self.w1 = mk(email="w1@example.com", password="x-Pass-12345", full_name="Writer One", role=User.Role.WRITER)
        self.w2 = mk(email="w2@example.com", password="x-Pass-12345", full_name="Writer Two", role=User.Role.WRITER)
        self.w3 = mk(email="w3@example.com", password="x-Pass-12345", full_name="No Works", role=User.Role.WRITER)
        self.b1 = Book.objects.create(author=self.w1, title="Live Book", genre="Drama",
                                      status=Book.Status.PUBLISHED, views=10)
        self.b2 = Book.objects.create(author=self.w2, title="Draft Book", genre="Drama",
                                      status=Book.Status.DRAFT)
        Poem.objects.create(author=self.w2, title="Live Poem", status=Poem.Status.PUBLISHED, views=5)
        self.api = APIClient()

    def test_showcase_lists_only_real_published_content(self):
        self.api.force_authenticate(self.editor)
        data = self.api.get("/api/editorial/showcase/").data
        self.assertEqual([b["title"] for b in data["books"]], ["Live Book"])
        names = {w["name"]: w for w in data["writers"]}
        self.assertEqual(set(names), {"Writer One", "Writer Two"})
        self.assertEqual(names["Writer One"]["reads"], 10)
        self.assertEqual(names["Writer Two"]["works"], 1)

    def test_only_editorial_staff_can_use_showcase(self):
        self.api.force_authenticate(self.moderator)
        self.assertEqual(self.api.get("/api/editorial/showcase/").status_code, 403)
        self.assertEqual(self.api.post(f"/api/editorial/books/{self.b1.pk}/featured/",
                                       {"featured": True}, format="json").status_code, 403)
        self.assertEqual(self.api.post(f"/api/editorial/writers/{self.w1.pk}/spotlight/",
                                       {"spotlight": True}, format="json").status_code, 403)

    def test_feature_book_is_audited_and_requires_published(self):
        self.api.force_authenticate(self.editor)
        r = self.api.post(f"/api/editorial/books/{self.b1.pk}/featured/", {"featured": True}, format="json")
        self.assertEqual(r.status_code, 200)
        self.b1.refresh_from_db()
        self.assertTrue(self.b1.is_featured)
        self.assertTrue(AuditLog.objects.filter(action="book_featured", target_id=str(self.b1.pk)).exists())
        bad = self.api.post(f"/api/editorial/books/{self.b2.pk}/featured/", {"featured": True}, format="json")
        self.assertEqual(bad.status_code, 400)

    def test_only_one_spotlight_writer_at_a_time(self):
        self.api.force_authenticate(self.director)
        url = lambda u: f"/api/editorial/writers/{u.pk}/spotlight/"
        self.assertEqual(self.api.post(url(self.w1), {"spotlight": True}, format="json").status_code, 200)
        self.assertEqual(self.api.post(url(self.w2), {"spotlight": True}, format="json").status_code, 200)
        self.w1.refresh_from_db(); self.w2.refresh_from_db()
        self.assertFalse(self.w1.is_spotlight)
        self.assertTrue(self.w2.is_spotlight)
        self.assertEqual(self.api.post(url(self.director), {"spotlight": True}, format="json").status_code, 404)
        public = APIClient().get("/api/auth/spotlight/")
        self.assertEqual(public.data["id"], self.w2.pk)



class ModeratorContentTests(TestCase):
    """Moderator asarlarni ko'ra va yashira oladi, lekin tahrirlay olmaydi."""

    def setUp(self):
        mk = lambda email, role: User.objects.create_user(
            email=email, password="SafePassword123!", full_name=email, role=role)
        self.writer = mk("w@example.com", User.Role.WRITER)
        self.moderator = mk("m@example.com", User.Role.MODERATOR)
        self.editor = mk("e@example.com", User.Role.TAHRIRCHI)
        self.reader = mk("r@example.com", User.Role.READER)
        self.book = Book.objects.create(author=self.writer, title="B", genre="fiction",
                                        status=Book.Status.PUBLISHED)
        Chapter.objects.create(book=self.book, title="C", content="x",
                               status=Chapter.Status.PUBLISHED)
        self.poem = Poem.objects.create(author=self.writer, title="P", content="a\nb",
                                        status=Poem.Status.PUBLISHED)

    def as_user(self, user):
        client = APIClient()
        client.force_authenticate(user)
        return client

    def test_moderator_can_list_works(self):
        r = self.as_user(self.moderator).get("/api/editorial/works/?scope=all")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.as_user(self.reader).get("/api/editorial/works/").status_code, 403)

    def test_moderator_can_hide_and_unhide_book_and_poem(self):
        c = self.as_user(self.moderator)
        r = c.post(f"/api/editorial/books/{self.book.pk}/action/",
                   {"action": "hide", "reason": "Qoida buzilishi"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.book.refresh_from_db()
        self.assertEqual(self.book.status, Book.Status.HIDDEN)
        r = c.post(f"/api/editorial/books/{self.book.pk}/action/", {"action": "unhide"}, format="json")
        self.assertEqual(r.status_code, 200)
        r = c.post(f"/api/editorial/poems/{self.poem.pk}/action/",
                   {"action": "hide", "reason": "x"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.poem.refresh_from_db()
        self.assertTrue(self.poem.is_hidden)

    def test_moderator_cannot_edit_or_publish(self):
        c = self.as_user(self.moderator)
        for action in ("claim", "publish", "return", "release"):
            r = c.post(f"/api/editorial/books/{self.book.pk}/action/", {"action": action}, format="json")
            self.assertEqual(r.status_code, 403, action)
            r = c.post(f"/api/editorial/poems/{self.poem.pk}/action/", {"action": action}, format="json")
            self.assertEqual(r.status_code, 403, action)
        r = c.post("/api/editorial/chapters/1/action/", {"action": "publish"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_editor_can_hide(self):
        r = self.as_user(self.editor).post(f"/api/editorial/books/{self.book.pk}/action/",
                                           {"action": "hide", "reason": "x"}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_reader_and_writer_cannot_hide(self):
        for user in (self.reader, self.writer):
            r = self.as_user(user).post(f"/api/editorial/books/{self.book.pk}/action/",
                                        {"action": "hide", "reason": "x"}, format="json")
            self.assertEqual(r.status_code, 403)