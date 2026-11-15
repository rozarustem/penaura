"""Bildirishnomalar: kuzatilgan yozuvchi yangi bob yoki kitob chiqarganda kuzatuvchilarga xabar.

API:
  GET  /api/auth/notifications/        -> {"unread": 3, "results": [...]}   (oxirgi 30 ta)
  POST /api/auth/notifications/read/   {"ids": [1, 2]} yoki {} (hammasini o'qilgan qiladi)
"""
from django.db import transaction
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Follow, Notification

LIST_LIMIT = 30


def notify_followers_about_publish(book, chapters, is_new_book):
    """Yozuvchining kuzatuvchilariga yangi nashr haqida xabar yuboradi.

    chapters: hozir nashr qilingan Chapter obyektlari ro'yxati.
    is_new_book: kitob shu nashr bilan birinchi marta chiqdimi.
    Avval xabar yuborilgan bob (followers_notified=True) qayta nashr qilinsa, xabar bormaydi.
    Yuborilgan xabarlar sonini qaytaradi.
    """
    from apps.catalog.models import Book, Chapter

    if book.status == Book.Status.HIDDEN:
        return 0
    fresh = [c for c in chapters if not c.followers_notified]
    if not fresh:
        return 0
    Chapter.objects.filter(pk__in=[c.pk for c in fresh]).update(followers_notified=True)

    follower_ids = list(
        Follow.objects.filter(writer_id=book.author_id, follower__is_active=True)
        .values_list("follower_id", flat=True))
    if not follower_ids:
        return 0

    writer_name = book.author.full_name
    if is_new_book:
        kind = Notification.Kind.NEW_BOOK
        message = f"{writer_name} yangi kitob chiqardi: «{book.title}»"
        chapter = None
    elif len(fresh) == 1:
        kind = Notification.Kind.NEW_CHAPTER
        message = f"{writer_name}: «{book.title}» kitobida yangi bob — {fresh[0].title}"
        chapter = fresh[0]
    else:
        kind = Notification.Kind.NEW_CHAPTER
        message = f"{writer_name}: «{book.title}» kitobida {len(fresh)} ta yangi bob chiqdi"
        chapter = None

    Notification.objects.bulk_create([
        Notification(user_id=uid, kind=kind, message=message[:255], book=book, chapter=chapter)
        for uid in follower_ids])
    return len(follower_ids)


def _url(n):
    if not n.book_id:
        return ""
    url = "book.html?book=" + n.book.slug
    if n.chapter_id:
        url += f"&chapter={n.chapter_id}"
    return url


def _row(n):
    return {"id": n.id, "kind": n.kind, "message": n.message, "url": _url(n),
            "is_read": n.is_read, "created_at": n.created_at}


class NotificationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = Notification.objects.filter(user=request.user)
        rows = qs.select_related("book", "chapter")[:LIST_LIMIT]
        return Response({"unread": qs.filter(is_read=False).count(),
                         "results": [_row(n) for n in rows]})


class NotificationReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        qs = Notification.objects.filter(user=request.user, is_read=False)
        ids = request.data.get("ids")
        if ids is not None:
            if not isinstance(ids, list) or not all(isinstance(i, int) for i in ids):
                return Response({"ids": ["ID lar butun sonlar ro'yxati bo'lishi kerak."]}, status=400)
            qs = qs.filter(pk__in=ids)
        with transaction.atomic():
            qs.update(is_read=True)
        return Response({"unread": Notification.objects.filter(
            user=request.user, is_read=False).count()})