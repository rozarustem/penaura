from django.test import TestCase
from rest_framework.test import APIClient

from apps.catalog.models import Book, Chapter

from .models import Follow, Notification, User


def make(email, role):
    return User.objects.create_user(email=email, password="SafePassword123!",
                                    full_name=email.split("@")[0], role=role)


def client(user=None):
    c = APIClient()
    if user:
        c.force_authenticate(user)
    return c


class NewChapterNotificationTests(TestCase):
    def setUp(self):
        self.writer = make("writer@example.com", User.Role.WRITER)
        self.fan = make("fan@example.com", User.Role.READER)
        self.stranger = make("stranger@example.com", User.Role.READER)
        self.editor = make("editor@example.com", User.Role.TAHRIRCHI)
        Follow.objects.create(follower=self.fan, writer=self.writer)
        self.book = Book.objects.create(author=self.writer, title="Qora kitob", genre="fiction",
                                        status=Book.Status.PUBLISHED, editor_lock_user=self.editor)

    def _chapter(self, title="Yangi bob", order=1, **extra):
        return Chapter.objects.create(book=self.book, title=title, content="<p>x</p>", order=order,
                                      status=extra.pop("status", Chapter.Status.SUBMITTED), **extra)

    def _chapter_action(self, chapter, action):
        with self.captureOnCommitCallbacks(execute=True):
            r = client(self.editor).post(f"/api/editorial/chapters/{chapter.pk}/action/",
                                         {"action": action}, format="json")
        self.assertEqual(r.status_code, 200, r.data)

    def test_follower_gets_notification_for_new_chapter(self):
        ch = self._chapter("Ikkinchi bob")
        self._chapter_action(ch, "publish")
        n = Notification.objects.get(user=self.fan)
        self.assertEqual(n.kind, Notification.Kind.NEW_CHAPTER)
        self.assertIn("Ikkinchi bob", n.message)
        self.assertIn("Qora kitob", n.message)
        self.assertFalse(n.is_read)
        self.assertEqual(n.chapter, ch)

    def test_non_follower_and_writer_get_nothing(self):
        self._chapter_action(self._chapter(), "publish")
        self.assertFalse(Notification.objects.filter(user=self.stranger).exists())
        self.assertFalse(Notification.objects.filter(user=self.writer).exists())

    def test_republishing_same_chapter_does_not_notify_twice(self):
        ch = self._chapter()
        self._chapter_action(ch, "publish")
        for action in ("unpublish", "publish"):
            # tahrirchi bob navbatidan bo'shagach, asarni qayta band qilishi kerak
            Book.objects.filter(pk=self.book.pk).update(editor_lock_user=self.editor)
            self._chapter_action(ch, action)
        self.assertEqual(Notification.objects.filter(user=self.fan).count(), 1)

    def test_first_publication_of_book_says_new_book(self):
        self.book.status = Book.Status.SUBMITTED
        self.book.save()
        self._chapter_action(self._chapter(), "publish")
        n = Notification.objects.get(user=self.fan)
        self.assertEqual(n.kind, Notification.Kind.NEW_BOOK)
        self.assertIn("yangi kitob", n.message)

    def test_bulk_publish_sends_one_summary_notification(self):
        self._chapter("A", 1)
        self._chapter("B", 2)
        self._chapter("C", 3)
        with self.captureOnCommitCallbacks(execute=True):
            r = client(self.editor).post(f"/api/editorial/books/{self.book.pk}/action/",
                                         {"action": "publish"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        n = Notification.objects.get(user=self.fan)
        self.assertIn("3 ta yangi bob", n.message)

    def test_hidden_book_does_not_notify(self):
        self.book.status = Book.Status.HIDDEN
        self.book.save()
        self._chapter_action(self._chapter(), "publish")
        self.assertFalse(Notification.objects.exists())

    def test_old_published_chapters_are_not_new(self):
        old = self._chapter(status=Chapter.Status.PUBLISHED)
        # migratsiya shunday boblarni followers_notified=True qiladi
        Chapter.objects.filter(pk=old.pk).update(followers_notified=True)
        self.assertFalse(Notification.objects.exists())


class NotificationApiTests(TestCase):
    def setUp(self):
        self.user = make("a@example.com", User.Role.READER)
        self.other = make("b@example.com", User.Role.READER)
        self.n1 = Notification.objects.create(user=self.user, kind="new_chapter", message="bir")
        self.n2 = Notification.objects.create(user=self.user, kind="new_book", message="ikki")
        self.theirs = Notification.objects.create(user=self.other, kind="new_book", message="boshqa")

    def test_requires_login(self):
        self.assertEqual(client().get("/api/auth/notifications/").status_code, 401)
        self.assertEqual(client().post("/api/auth/notifications/read/").status_code, 401)

    def test_list_shows_only_own_with_unread_count(self):
        d = client(self.user).get("/api/auth/notifications/").data
        self.assertEqual(d["unread"], 2)
        self.assertEqual({r["message"] for r in d["results"]}, {"bir", "ikki"})

    def test_link_points_to_book_and_chapter(self):
        writer = make("w@example.com", User.Role.WRITER)
        book = Book.objects.create(author=writer, title="K", genre="fiction",
                                   status=Book.Status.PUBLISHED)
        ch = Chapter.objects.create(book=book, title="B1", status=Chapter.Status.PUBLISHED)
        Notification.objects.create(user=self.user, kind="new_chapter", message="x",
                                    book=book, chapter=ch)
        rows = client(self.user).get("/api/auth/notifications/").data["results"]
        self.assertEqual(rows[0]["url"], f"book.html?book={book.slug}&chapter={ch.pk}")

    def test_mark_all_read(self):
        d = client(self.user).post("/api/auth/notifications/read/", {}, format="json").data
        self.assertEqual(d["unread"], 0)
        self.theirs.refresh_from_db()
        self.assertFalse(self.theirs.is_read)

    def test_mark_selected_read(self):
        d = client(self.user).post("/api/auth/notifications/read/",
                                   {"ids": [self.n1.pk]}, format="json").data
        self.assertEqual(d["unread"], 1)

    def test_cannot_mark_someone_elses(self):
        client(self.user).post("/api/auth/notifications/read/",
                               {"ids": [self.theirs.pk]}, format="json")
        self.theirs.refresh_from_db()
        self.assertFalse(self.theirs.is_read)

    def test_bad_ids_rejected(self):
        r = client(self.user).post("/api/auth/notifications/read/", {"ids": ["x"]}, format="json")
        self.assertEqual(r.status_code, 400)