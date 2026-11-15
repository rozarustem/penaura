from django.db import transaction
from django.db.models import ProtectedError
from django.db.models import Avg, Count, F, Max, Q, Sum
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics, permissions
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework import status as http_status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import (AuditLog, ChapterUnlock, RevenueSplit, Follow, ReadingProgress,
                                  User, Wallet, WalletTransaction)

from apps.accounts.earnings import split_amount
from apps.accounts.notifications import notify_followers_about_publish
from .models import (Article, Book, BookBookmark, BookLike, Chapter, Poem,
                     PoemBookmark, PoemRating)
from .permissions import (IsContentStaff, IsDirector, IsEditorialStaff, IsOwnerOrReadOnly,
                          IsWriter)
from .serializers import (ArticleSerializer, BookDetailSerializer, BookSerializer,
                          ChapterSerializer, MyBookSerializer, PoemSerializer)


# Asarni yashirish / qayta ko'rsatish huquqi
HIDE_ROLES = (User.Role.DIREKTOR, User.Role.TAHRIRCHI, User.Role.MODERATOR)


def books_qs():
    return Book.objects.select_related("author").annotate(
        likes_count=Count("likes", distinct=True),
        chapters_count=Count("chapters", filter=Q(chapters__status="published"),
                             distinct=True),
    )


def is_staff_user(user):
    return user.is_authenticated and user.role in User.STAFF_ROLES


def is_director(user):
    return user.is_authenticated and user.role == User.Role.DIREKTOR


def can_read_chapter(user, chapter):
    """Premium bob matnini kim o'qiy oladi."""
    if not chapter.is_premium:
        return True
    if user.is_authenticated and (user.id == chapter.book.author_id or is_staff_user(user)):
        return True
    return user.is_authenticated and ChapterUnlock.objects.filter(
        user=user, chapter=chapter).exists()


def changed_fields(instance, validated_data, fields):
    """validated_data ichidan instance'dagidan farq qiladigan (fields ro'yxatidagi) maydonlar."""
    return [f for f in fields if f in validated_data and validated_data[f] != getattr(instance, f)]


# Nashr qilingan asarda shu maydonlar o'zgarsa, tahririyat qayta ko'rib chiqadi.
CHAPTER_REVIEW_FIELDS = ("title", "content")
POEM_REVIEW_FIELDS = ("title", "content", "excerpt", "topic", "genre", "tags")


class SafeDeleteMixin:
    """Sotib olingan boblarning pul yozuvlari (RevenueSplit) o'chirishdan himoyalangan.

    Bunday kitob/bobni o'chirishga urinilsa, 500 xato o'rniga 409 va tushunarli xabar qaytadi.
    """
    protected_message = ("Bu asarning boblarini o'quvchilar sotib olishgan va pul hisobi yuritilgan, "
                         "shuning uchun uni o'chirib bo'lmaydi. Yashirish uchun tahririyatga murojaat qiling.")

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            with transaction.atomic():
                self.perform_destroy(instance)
        except ProtectedError:
            return Response({"detail": self.protected_message},
                            status=http_status.HTTP_409_CONFLICT)
        return Response(status=http_status.HTTP_204_NO_CONTENT)


class BookListCreateView(generics.ListCreateAPIView):
    serializer_class = BookSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["genre", "language", "author"]
    search_fields = ["title", "description", "author__full_name"]
    ordering_fields = ["views", "created_at", "likes_count"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return books_qs().filter(status=Book.Status.PUBLISHED)

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsWriter()]
        return [permissions.AllowAny()]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class MyBooksView(generics.ListAPIView):
    serializer_class = MyBookSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return (books_qs().filter(author=self.request.user)
                .prefetch_related("chapters").order_by("-created_at"))


class BookDetailView(SafeDeleteMixin, generics.RetrieveUpdateDestroyAPIView):
    lookup_field = "slug"
    permission_classes = [IsOwnerOrReadOnly]

    def get_serializer_class(self):
        return BookDetailSerializer if self.request.method == "GET" else BookSerializer

    def get_queryset(self):
        qs = books_qs()
        user = self.request.user
        if is_staff_user(user):
            return qs
        if user.is_authenticated:
            return qs.filter(Q(status=Book.Status.PUBLISHED) | Q(author=user))
        return qs.filter(status=Book.Status.PUBLISHED)

    def retrieve(self, request, *args, **kwargs):
        book = self.get_object()
        Book.objects.filter(pk=book.pk).update(views=F("views") + 1)
        return Response(self.get_serializer(book).data)


class BookLikeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        book = get_object_or_404(Book, slug=slug, status=Book.Status.PUBLISHED)
        like, created = BookLike.objects.get_or_create(user=request.user, book=book)
        if not created:
            like.delete()
        return Response({"liked": created, "likes_count": book.likes.count()})


class BookBookmarkView(APIView):
    """POST — saqlash/olib tashlash (almashtirish); javob: {"saved": true|false}.

    DELETE — saqlanganlardan aniq olib tashlash (kitob keyin yashirilgan bo'lsa ham ishlaydi).
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        book = get_object_or_404(Book, slug=slug, status=Book.Status.PUBLISHED)
        bookmark, created = BookBookmark.objects.get_or_create(user=request.user, book=book)
        if not created:
            bookmark.delete()
        return Response({"saved": created})

    def delete(self, request, slug):
        BookBookmark.objects.filter(user=request.user, book__slug=slug).delete()
        return Response({"saved": False})


class ChapterCreateView(generics.CreateAPIView):
    serializer_class = ChapterSerializer
    permission_classes = [IsWriter]

    def perform_create(self, serializer):
        book = get_object_or_404(Book, slug=self.kwargs["slug"], author=self.request.user)
        last = book.chapters.aggregate(m=Max("order"))["m"] or 0
        status_value = serializer.validated_data.get("status", Chapter.Status.DRAFT)
        serializer.save(
            book=book, order=last + 1,
            submitted_at=timezone.now() if status_value == Chapter.Status.SUBMITTED else None,
        )


class ChapterDetailView(SafeDeleteMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ChapterSerializer
    permission_classes = [IsOwnerOrReadOnly]

    def get_queryset(self):
        return Chapter.objects.filter(book__slug=self.kwargs["slug"]).select_related("book")

    def retrieve(self, request, *args, **kwargs):
        chapter = self.get_object()
        book = chapter.book
        user = request.user
        is_owner = user.is_authenticated and user.id == book.author_id
        if not (is_owner or is_staff_user(user)):
            if chapter.status != Chapter.Status.PUBLISHED or book.status != Book.Status.PUBLISHED:
                raise Http404
        data = dict(self.get_serializer(chapter).data)
        if can_read_chapter(user, chapter):
            data["locked"] = False
            Chapter.objects.filter(pk=chapter.pk).update(views=F("views") + 1)
        else:
            data["content"] = ""
            data["locked"] = True
        return Response(data)

    def perform_update(self, serializer):
        chapter = serializer.instance
        status_value = serializer.validated_data.get("status")
        if status_value == Chapter.Status.SUBMITTED:
            serializer.save(submitted_at=timezone.now(), returned_at=None, edited=False)
        elif (status_value is None and chapter.status == Chapter.Status.PUBLISHED
                and changed_fields(chapter, serializer.validated_data, CHAPTER_REVIEW_FIELDS)):
            # Nashr qilingan bobning matni o'zgardi: tahririyat qayta tekshirmaguncha saytdan olinadi.
            serializer.save(status=Chapter.Status.SUBMITTED, submitted_at=timezone.now(),
                            returned_at=None, published_at=None, edited=False)
        else:
            serializer.save()


class ChapterUnlockView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug, pk):
        chapter = get_object_or_404(
            Chapter.objects.select_related("book"),
            pk=pk, book__slug=slug, status=Chapter.Status.PUBLISHED,
            book__status=Book.Status.PUBLISHED, is_premium=True,
        )
        if chapter.book.author_id == request.user.id or is_staff_user(request.user):
            return Response({"unlocked": True, "already_unlocked": True})
        if ChapterUnlock.objects.filter(user=request.user, chapter=chapter).exists():
            return Response({"unlocked": True, "already_unlocked": True})
        with transaction.atomic():
            wallet, _ = Wallet.objects.select_for_update().get_or_create(user=request.user)
            if ChapterUnlock.objects.filter(user=request.user, chapter=chapter).exists():
                return Response({"unlocked": True, "already_unlocked": True})
            if wallet.balance < chapter.price:
                return Response(
                    {"detail": "Tanga yetarli emas.", "balance": wallet.balance,
                     "price": chapter.price},
                    status=400,
                )
            wallet.balance -= chapter.price
            wallet.save(update_fields=["balance", "updated_at"])
            entry = WalletTransaction.objects.create(
                wallet=wallet, kind=WalletTransaction.Kind.CHAPTER_UNLOCK,
                amount=chapter.price, balance_after=wallet.balance,
                reference=f"chapter:{chapter.pk}",
            )
            unlock = ChapterUnlock.objects.create(
                user=request.user, chapter=chapter, transaction=entry,
            )
            # Pul shu zahoti yozuvchi (70%) va platforma (30%) o'rtasida bo'linadi.
            RevenueSplit.objects.create(
                unlock=unlock, reader=request.user, writer_id=chapter.book.author_id,
                chapter=chapter, coins=chapter.price, **split_amount(chapter.price),
            )
        return Response({"unlocked": True, "already_unlocked": False,
                         "balance": wallet.balance})


class ReadingProgressView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        rows = ReadingProgress.objects.filter(user=request.user).select_related(
            "book", "book__author", "chapter").annotate(
            chapters_total=Count("book__chapters",
                                 filter=Q(book__chapters__status="published"),
                                 distinct=True),
        ).order_by("-updated_at")[:20]
        data = []
        for row in rows:
            position = 0
            if row.chapter_id:
                position = row.book.chapters.filter(
                    status="published", order__lte=row.chapter.order).count()
            data.append({
                "book_id": row.book_id, "book_slug": row.book.slug,
                "book_title": row.book.title,
                "author_id": row.book.author_id,
                "author_name": row.book.author.full_name,
                "cover": request.build_absolute_uri(row.book.cover.url) if row.book.cover else "",
                "chapters_total": row.chapters_total,
                "chapter_position": position,
                "chapter_id": row.chapter_id,
                "chapter_title": row.chapter.title if row.chapter else "",
                "updated_at": row.updated_at,
            })
        return Response(data)

    def post(self, request):
        book = get_object_or_404(Book, pk=request.data.get("book_id"),
                                 status=Book.Status.PUBLISHED)
        chapter_id = request.data.get("chapter_id")
        chapter = None
        if chapter_id is not None:
            chapter = get_object_or_404(
                Chapter, pk=chapter_id, book=book, status=Chapter.Status.PUBLISHED,
            )
        row, _ = ReadingProgress.objects.update_or_create(
            user=request.user, book=book, defaults={"chapter": chapter},
        )
        return Response({"book_id": row.book_id, "chapter_id": row.chapter_id,
                         "updated_at": row.updated_at})


class FollowView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(list(request.user.following.values_list("writer_id", flat=True)))

    def post(self, request, user_id):
        writer = get_object_or_404(User, pk=user_id, role=User.Role.WRITER)
        if writer.pk == request.user.pk:
            return Response({"detail": "O'zingizni kuzata olmaysiz."}, status=400)
        follow, created = Follow.objects.get_or_create(follower=request.user, writer=writer)
        if not created:
            follow.delete()
        return Response({"following": created, "writer_id": writer.pk})


class PoemListCreateView(generics.ListCreateAPIView):
    serializer_class = PoemSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["topic", "genre", "author"]
    search_fields = ["title", "content", "author__full_name"]
    ordering_fields = ["views", "created_at", "rating"]
    ordering = ["-created_at"]

    def get_queryset(self):
        qs = Poem.objects.select_related("author")
        user = self.request.user
        if user.is_authenticated and (user.role in User.STAFF_ROLES):
            return qs
        if user.is_authenticated:
            return qs.filter(Q(status=Poem.Status.PUBLISHED, is_hidden=False) |
                             Q(author=user))
        return qs.filter(status=Poem.Status.PUBLISHED, is_hidden=False)

    def get_permissions(self):
        return [IsWriter()] if self.request.method == "POST" else [permissions.AllowAny()]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


class PoemDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PoemSerializer
    lookup_field = "slug"
    permission_classes = [IsOwnerOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        qs = Poem.objects.select_related("author")
        if is_staff_user(user):
            return qs
        if user.is_authenticated:
            return qs.filter(Q(status=Poem.Status.PUBLISHED, is_hidden=False) |
                             Q(author=user))
        return qs.filter(status=Poem.Status.PUBLISHED, is_hidden=False)

    def perform_update(self, serializer):
        poem = serializer.instance
        status_value = serializer.validated_data.get("status")
        if status_value == Poem.Status.SUBMITTED:
            serializer.save(submitted_at=timezone.now(), edited=False)
        elif (status_value is None and poem.status == Poem.Status.PUBLISHED
                and changed_fields(poem, serializer.validated_data, POEM_REVIEW_FIELDS)):
            # Nashr qilingan she'r o'zgardi: tahririyat qayta tekshirmaguncha saytdan olinadi.
            serializer.save(status=Poem.Status.SUBMITTED, submitted_at=timezone.now(),
                            published_at=None, edited=False)
        else:
            serializer.save()


class MyPoemsView(generics.ListAPIView):
    serializer_class = PoemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Poem.objects.filter(author=self.request.user).select_related("author")


def _public_poem(slug):
    """Faqat saytda ko'rinadigan (nashr qilingan, yashirilmagan) she'r."""
    return get_object_or_404(Poem, slug=slug, status=Poem.Status.PUBLISHED, is_hidden=False)


class PoemActivityView(APIView):
    """GET /poems/activity/ — joriy foydalanuvchining baholari va saqlangan she'rlari (bitta so'rovda).

    Javob: {"ratings": {"<poem_id>": 1..5}, "bookmarks": [<poem_id>, ...]}
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        ratings = {str(pid): value for pid, value in
                   PoemRating.objects.filter(user=request.user).values_list("poem_id", "value")}
        bookmarks = list(PoemBookmark.objects.filter(user=request.user)
                         .values_list("poem_id", flat=True))
        return Response({"ratings": ratings, "bookmarks": bookmarks})


class PoemRatingView(APIView):
    """PUT {"value": 1..5} — baho qo'yish yoki o'zgartirish; DELETE — bahoni olib tashlash.

    She'r bahosi (Poem.rating) barcha foydalanuvchilar baholarining o'rtachasi bo'lib yangilanadi.
    Yozuvchi o'z she'rini baholay olmaydi.
    """
    permission_classes = [permissions.IsAuthenticated]

    @staticmethod
    def _summary(poem):
        agg = poem.ratings.aggregate(avg=Avg("value"), n=Count("id"))
        poem.rating = round(agg["avg"], 1) if agg["avg"] else 0
        poem.save(update_fields=["rating"])
        return {"rating": poem.rating, "ratings_count": agg["n"]}

    def put(self, request, slug):
        poem = _public_poem(slug)
        if poem.author_id == request.user.id:
            return Response({"detail": "O'z she'ringizni baholay olmaysiz."}, status=400)
        try:
            value = int(request.data.get("value"))
        except (TypeError, ValueError):
            value = 0
        if not 1 <= value <= 5:
            return Response({"value": "Baho 1 dan 5 gacha bo'lishi kerak."}, status=400)
        with transaction.atomic():
            PoemRating.objects.update_or_create(
                user=request.user, poem=poem, defaults={"value": value})
            summary = self._summary(poem)
        return Response({"my_rating": value, **summary})

    def delete(self, request, slug):
        poem = _public_poem(slug)
        with transaction.atomic():
            PoemRating.objects.filter(user=request.user, poem=poem).delete()
            summary = self._summary(poem)
        return Response({"my_rating": 0, **summary})


class PoemBookmarkView(APIView):
    """POST — saqlash/olib tashlash (almashtirish); javob: {"bookmarked": true|false}."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        poem = _public_poem(slug)
        bookmark, created = PoemBookmark.objects.get_or_create(user=request.user, poem=poem)
        if not created:
            bookmark.delete()
        return Response({"bookmarked": created})

    def delete(self, request, slug):
        """Saqlanganlardan aniq olib tashlash (she'r keyin yashirilgan bo'lsa ham ishlaydi)."""
        PoemBookmark.objects.filter(user=request.user, poem__slug=slug).delete()
        return Response({"bookmarked": False})


class SavedView(APIView):
    """GET /saved/ — joriy foydalanuvchi saqlagan kitob va she'rlar (eng oxirgi saqlangani birinchi).

    Faqat saytda ko'rinadigan asarlar qaytariladi: nashr qilingan va yashirilmagan.
    Javob: {"books": [...], "poems": [...]}
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        book_ids = list(BookBookmark.objects
                        .filter(user=request.user, book__status=Book.Status.PUBLISHED)
                        .order_by("-created_at").values_list("book_id", flat=True))
        books = {b.pk: b for b in books_qs().filter(pk__in=book_ids)}
        ordered_books = [books[i] for i in book_ids if i in books]

        poem_ids = list(PoemBookmark.objects
                        .filter(user=request.user, poem__status=Poem.Status.PUBLISHED,
                                poem__is_hidden=False)
                        .order_by("-created_at").values_list("poem_id", flat=True))
        poems = {p.pk: p for p in Poem.objects.select_related("author").filter(pk__in=poem_ids)}
        ordered_poems = [poems[i] for i in poem_ids if i in poems]

        ctx = {"request": request}
        return Response({
            "books": BookSerializer(ordered_books, many=True, context=ctx).data,
            "poems": PoemSerializer(ordered_poems, many=True, context=ctx).data,
        })


def _article_audit(request, action, article):
    AuditLog.objects.create(
        actor=request.user, action=action, target_type="article",
        target_id=str(article.pk), details={"title": article.title},
    )


class ArticleListCreateView(generics.ListCreateAPIView):
    """Blog maqolalari.

    GET  /articles/            — hamma uchun, faqat chop etilganlar (?category=, ?page=).
    GET  /articles/?scope=all  — direktor uchun qoralamalar bilan birga.
    POST /articles/            — faqat direktor; har doim qoralama bo'lib yaratiladi.
    """
    serializer_class = ArticleSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)

    def get_queryset(self):
        qs = Article.objects.all()
        if not (self.request.query_params.get("scope") == "all" and is_director(self.request.user)):
            qs = qs.filter(status=Article.Status.PUBLISHED)
        category = self.request.query_params.get("category", "").strip()
        if category and category.lower() != "all":
            qs = qs.filter(category__iexact=category)
        return qs

    def get_permissions(self):
        return [IsDirector()] if self.request.method == "POST" else [permissions.AllowAny()]

    def perform_create(self, serializer):
        article = serializer.save(status=Article.Status.DRAFT)
        _article_audit(self.request, "article_create", article)


class ArticleDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ArticleSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    lookup_field = "slug"

    def get_permissions(self):
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            return [permissions.AllowAny()]
        return [IsDirector()]

    def get_queryset(self):
        qs = Article.objects.all()
        if is_director(self.request.user):
            return qs
        return qs.filter(status=Article.Status.PUBLISHED)

    def perform_update(self, serializer):
        previous = serializer.instance.status
        status_value = serializer.validated_data.get("status")
        if status_value == Article.Status.PUBLISHED:
            # Sana faqat birinchi chop etilganda qo'yiladi; keyingi tahrirlarda o'zgarmaydi
            if previous != Article.Status.PUBLISHED or not serializer.instance.published_at:
                article = serializer.save(published_at=timezone.now())
            else:
                article = serializer.save()
        elif status_value == Article.Status.DRAFT:
            article = serializer.save(published_at=None)
        else:
            article = serializer.save()
        if previous != article.status:
            action = "article_publish" if article.status == Article.Status.PUBLISHED else "article_unpublish"
        else:
            action = "article_update"
        _article_audit(self.request, action, article)

    def perform_destroy(self, instance):
        _article_audit(self.request, "article_delete", instance)
        instance.delete()


def _work_chapter(c):
    return {
        "id": c.id, "title": c.title, "content": c.content, "status": c.status,
        "order": c.order, "is_premium": c.is_premium, "price": c.price,
        "edited": c.edited, "editor_note": c.editor_note,
        "submitted_at": c.submitted_at, "published_at": c.published_at,
        "created_at": c.created_at, "updated_at": c.updated_at,
    }


class EditorialWorkListView(APIView):
    """Tahririyat ro'yxati.

    Odatda faqat navbatdagi (yuborilgan / tahrirdagi) asarlar qaytadi.
    ?scope=all — saytdagi, qaytarilgan va yashirilgan asarlar ham (draftdan boshqa hammasi).
    Moderator ham ko'ra oladi (faqat o'qish).
    """
    permission_classes = [IsContentStaff]

    def get(self, request):
        in_review = (Chapter.Status.SUBMITTED, Chapter.Status.EDITING)
        if request.query_params.get("scope") == "all":
            book_q = (Q(chapters__status__in=in_review + (Chapter.Status.PUBLISHED,
                                                          Chapter.Status.RETURNED))
                      | Q(status=Book.Status.HIDDEN))
            poem_q = ~Q(status=Poem.Status.DRAFT)
        else:
            book_q = Q(status=Book.Status.SUBMITTED) | Q(chapters__status__in=in_review)
            poem_q = Q(status__in=(Poem.Status.SUBMITTED, Poem.Status.EDITING))
        books = (Book.objects.filter(book_q).distinct()
                 .select_related("author", "editor_lock_user").prefetch_related("chapters"))
        poems = Poem.objects.filter(poem_q).select_related("author", "editor_lock_user")
        return Response({
            "books": [
                {"id": book.pk, "slug": book.slug, "title": book.title,
                 "author": book.author.full_name, "author_id": book.author_id,
                 "genre": book.genre, "status": book.status,
                 "hidden_reason": book.hidden_reason, "created_at": book.created_at,
                 "lock_user": book.editor_lock_user_id,
                 "lock_user_name": (book.editor_lock_user.full_name
                                    if book.editor_lock_user else ""),
                 "lock_at": book.editor_lock_at,
                 "chapters": [_work_chapter(c) for c in book.chapters.all()]}
                for book in books
            ],
            "poems": [
                {"id": poem.pk, "slug": poem.slug, "title": poem.title,
                 "author": poem.author.full_name, "author_id": poem.author_id,
                 "genre": poem.genre, "status": poem.status, "edited": poem.edited,
                 "lock_user": poem.editor_lock_user_id,
                 "lock_user_name": (poem.editor_lock_user.full_name
                                    if poem.editor_lock_user else ""),
                 "content": poem.content, "excerpt": poem.excerpt,
                 "editor_note": poem.editor_note, "hidden": poem.is_hidden,
                 "hidden_reason": poem.hidden_reason, "created_at": poem.created_at,
                 "updated_at": poem.updated_at,
                 "lock_at": poem.editor_lock_at, "submitted_at": poem.submitted_at}
                for poem in poems
            ],
        })


class EditorialShowcaseView(APIView):
    """Tahririyat: sayt vitrinasi uchun haqiqiy ro'yxat.

    books — nashr qilingan kitoblar (tanlanganlari yuqorida), writers — nashr qilingan asari bor yozuvchilar.
    """
    permission_classes = [IsEditorialStaff]

    def get(self, request):
        books = (Book.objects.filter(status=Book.Status.PUBLISHED).select_related("author")
                 .order_by("-is_featured", "-views", "-created_at"))
        book_stats = {r["author_id"]: r for r in Book.objects.filter(status=Book.Status.PUBLISHED)
                      .values("author_id").annotate(works=Count("id"), reads=Sum("views"))}
        poem_stats = {r["author_id"]: r for r in Poem.objects.filter(status=Poem.Status.PUBLISHED,
                                                                     is_hidden=False)
                      .values("author_id").annotate(works=Count("id"), reads=Sum("views"))}
        writers = (User.objects.filter(pk__in=set(book_stats) | set(poem_stats),
                                       role=User.Role.WRITER, is_active=True, is_blocked=False)
                   .annotate(followers_total=Count("followers", distinct=True)))
        rows = []
        for w in writers:
            b, p = book_stats.get(w.pk, {}), poem_stats.get(w.pk, {})
            rows.append({"id": w.pk, "name": w.full_name, "followers": w.followers_total,
                         "works": (b.get("works") or 0) + (p.get("works") or 0),
                         "reads": (b.get("reads") or 0) + (p.get("reads") or 0),
                         "is_spotlight": w.is_spotlight})
        rows.sort(key=lambda r: (-r["reads"], r["name"]))
        return Response({
            "books": [{"id": b.pk, "slug": b.slug, "title": b.title, "author": b.author.full_name,
                       "author_id": b.author_id, "genre": b.genre, "views": b.views,
                       "is_featured": b.is_featured} for b in books],
            "writers": rows,
        })


class EditorialFeatureBookView(APIView):
    """POST /api/editorial/books/<id>/featured/  {"featured": true}"""
    permission_classes = [IsEditorialStaff]

    def post(self, request, pk):
        featured = request.data.get("featured")
        if not isinstance(featured, bool):
            return Response({"featured": ["Boolean qiymat yuboring."]}, status=400)
        book = get_object_or_404(Book, pk=pk)
        if featured and book.status != Book.Status.PUBLISHED:
            return Response({"detail": "Faqat nashr qilingan kitobni tanlash mumkin."}, status=400)
        if book.is_featured != featured:
            book.is_featured = featured
            book.save(update_fields=["is_featured", "updated_at"])
            AuditLog.objects.create(
                actor=request.user, action="book_featured" if featured else "book_unfeatured",
                target_type="book", target_id=str(book.pk), details={"title": book.title},
            )
        return Response({"id": book.pk, "is_featured": book.is_featured})


class EditorialSpotlightView(APIView):
    """POST /api/editorial/writers/<id>/spotlight/  {"spotlight": true}

    Bir vaqtda faqat bitta oy muallifi bo'ladi: yangisi belgilansa, avvalgisi olib tashlanadi.
    """
    permission_classes = [IsEditorialStaff]

    def post(self, request, pk):
        flag = request.data.get("spotlight")
        if not isinstance(flag, bool):
            return Response({"spotlight": ["Boolean qiymat yuboring."]}, status=400)
        with transaction.atomic():
            writer = get_object_or_404(User.objects.select_for_update(), pk=pk,
                                       role=User.Role.WRITER, is_active=True)
            if flag and writer.is_blocked:
                return Response({"detail": "Bloklangan yozuvchini tanlab bo'lmaydi."}, status=400)
            replaced = []
            if flag:
                others = User.objects.filter(is_spotlight=True).exclude(pk=writer.pk)
                replaced = list(others.values_list("pk", flat=True))
                others.update(is_spotlight=False)
            if writer.is_spotlight != flag:
                writer.is_spotlight = flag
                writer.save(update_fields=["is_spotlight"])
                AuditLog.objects.create(
                    actor=request.user, action="writer_spotlight" if flag else "writer_unspotlight",
                    target_type="user", target_id=str(writer.pk),
                    details={"name": writer.full_name, "replaced": replaced},
                )
        return Response({"id": writer.pk, "is_spotlight": writer.is_spotlight})


class EditorialBookActionView(APIView):
    permission_classes = [IsContentStaff]

    def post(self, request, pk):
        action = request.data.get("action")
        if request.user.role == User.Role.MODERATOR and action not in ("hide", "unhide"):
            return Response({"detail": "Moderator faqat asarni yashira yoki qayta ko'rsata oladi."},
                            status=403)
        with transaction.atomic():
            book = get_object_or_404(Book.objects.select_for_update(), pk=pk)
            if action == "claim":
                if (book.editor_lock_user_id not in (None, request.user.pk)
                        and request.user.role != User.Role.DIREKTOR):
                    return Response({"detail": "Asar boshqa tahrirchida band."}, status=409)
                book.editor_lock_user = request.user
                book.editor_lock_at = timezone.now()
                book.chapters.filter(status=Chapter.Status.SUBMITTED).update(
                    status=Chapter.Status.EDITING)
            elif action == "release":
                if book.editor_lock_user_id != request.user.pk:
                    return Response({"detail": "Asar sizda band emas."}, status=409)
                book.chapters.filter(status=Chapter.Status.EDITING).update(
                    status=Chapter.Status.SUBMITTED)
                book.editor_lock_user = None
                book.editor_lock_at = None
            elif action in ("publish", "return"):
                if book.editor_lock_user_id != request.user.pk:
                    return Response({"detail": "Avval asarni band qiling."}, status=409)
                note = str(request.data.get("note", "")).strip()
                chapters = book.chapters.filter(
                    status__in=(Chapter.Status.SUBMITTED, Chapter.Status.EDITING))
                if action == "return" and not note:
                    return Response({"note": ["Qaytarish sababi majburiy."]}, status=400)
                if action == "publish":
                    to_publish = list(chapters)
                    first_publication = book.status != Book.Status.PUBLISHED
                    chapters.update(status=Chapter.Status.PUBLISHED,
                                    published_at=timezone.now(), editor_note="")
                    book.status = Book.Status.PUBLISHED
                    transaction.on_commit(lambda: notify_followers_about_publish(
                        book, to_publish, first_publication))
                else:
                    chapters.update(status=Chapter.Status.RETURNED,
                                    returned_at=timezone.now(), editor_note=note)
                book.editor_lock_user = None
                book.editor_lock_at = None
            elif action == "hide":
                if request.user.role not in HIDE_ROLES:
                    return Response({"detail": "Yashirish uchun direktor, tahrirchi yoki moderator huquqi kerak."},
                                    status=403)
                book.status = Book.Status.HIDDEN
                book.hidden_reason = str(request.data.get("reason", "")).strip()
            elif action == "unhide":
                if request.user.role not in HIDE_ROLES:
                    return Response({"detail": "Ko'rsatish uchun direktor, tahrirchi yoki moderator huquqi kerak."},
                                    status=403)
                book.status = (Book.Status.PUBLISHED if
                               book.chapters.filter(status=Chapter.Status.PUBLISHED).exists()
                               else Book.Status.DRAFT)
                book.hidden_reason = ""
            else:
                return Response({"detail": "Noma'lum amal."}, status=400)
            book.save()
            AuditLog.objects.create(
                actor=request.user, action=f"book_{action}", target_type="book",
                target_id=str(book.pk), details={"note": request.data.get("note", "")},
            )
        return Response({"id": book.pk, "status": book.status,
                         "lock_user": book.editor_lock_user_id})


class EditorialChapterActionView(APIView):
    permission_classes = [IsEditorialStaff]

    def post(self, request, pk):
        action = request.data.get("action")
        with transaction.atomic():
            chapter = get_object_or_404(
                Chapter.objects.select_for_update().select_related("book"),
                pk=pk,
            )
            book = chapter.book
            if book.editor_lock_user_id != request.user.pk:
                return Response({"detail": "Avval asarni band qiling."}, status=409)
            if action == "publish":
                chapter.status = Chapter.Status.PUBLISHED
                chapter.published_at = timezone.now()
                chapter.editor_note = ""
            elif action == "return":
                note = str(request.data.get("note", "")).strip()
                if not note:
                    return Response({"note": ["Qaytarish sababi majburiy."]}, status=400)
                chapter.status = Chapter.Status.RETURNED
                chapter.returned_at = timezone.now()
                chapter.editor_note = note
            elif action == "unpublish":
                chapter.status = Chapter.Status.EDITING
                chapter.published_at = None
            elif action == "start":
                if chapter.status == Chapter.Status.SUBMITTED:
                    chapter.status = Chapter.Status.EDITING
            elif action == "edit":
                serializer = ChapterSerializer(chapter, data=request.data, partial=True)
                serializer.is_valid(raise_exception=True)
                # "Tahrirlandi" deb belgilash faqat so'ralganda (oddiy saqlashda emas)
                if str(request.data.get("edited")).lower() in ("true", "1"):
                    serializer.save(edited=True)
                else:
                    serializer.save()
            else:
                return Response({"detail": "Noma'lum amal."}, status=400)
            if action != "edit":
                chapter.save()
                if action == "publish":
                    first_publication = book.status in (Book.Status.DRAFT, Book.Status.SUBMITTED)
                    transaction.on_commit(lambda: notify_followers_about_publish(
                        book, [chapter], first_publication))
                if (action == "publish"
                        and book.status in (Book.Status.DRAFT, Book.Status.SUBMITTED)):
                    book.status = Book.Status.PUBLISHED
                # navbatda bob qolmasa, kitob tahrirchidan o'zi bo'shaydi
                if not book.chapters.filter(status__in=(
                        Chapter.Status.SUBMITTED, Chapter.Status.EDITING)).exists():
                    book.editor_lock_user = None
                    book.editor_lock_at = None
                book.save()
            AuditLog.objects.create(
                actor=request.user, action=f"chapter_{action}", target_type="chapter",
                target_id=str(chapter.pk), details={"book_id": book.pk},
            )
        return Response(ChapterSerializer(chapter).data)


class EditorialPoemActionView(APIView):
    permission_classes = [IsContentStaff]

    def post(self, request, pk):
        action = request.data.get("action")
        if request.user.role == User.Role.MODERATOR and action not in ("hide", "unhide"):
            return Response({"detail": "Moderator faqat asarni yashira yoki qayta ko'rsata oladi."},
                            status=403)
        with transaction.atomic():
            poem = get_object_or_404(Poem.objects.select_for_update(), pk=pk)
            if action == "claim":
                if (poem.editor_lock_user_id not in (None, request.user.pk)
                        and request.user.role != User.Role.DIREKTOR):
                    return Response({"detail": "She'r boshqa tahrirchida band."}, status=409)
                poem.editor_lock_user = request.user
                poem.editor_lock_at = timezone.now()
                poem.status = Poem.Status.EDITING
            elif action == "release":
                if poem.editor_lock_user_id != request.user.pk:
                    return Response({"detail": "She'r sizda band emas."}, status=409)
                poem.editor_lock_user = None
                poem.editor_lock_at = None
                poem.status = Poem.Status.SUBMITTED
            elif action in ("publish", "return"):
                if poem.editor_lock_user_id != request.user.pk:
                    return Response({"detail": "Avval she'rni band qiling."}, status=409)
                note = str(request.data.get("note", "")).strip()
                if action == "return" and not note:
                    return Response({"note": ["Qaytarish sababi majburiy."]}, status=400)
                poem.status = Poem.Status.PUBLISHED if action == "publish" else Poem.Status.RETURNED
                poem.published_at = timezone.now() if action == "publish" else None
                poem.editor_note = "" if action == "publish" else note
                poem.editor_lock_user = None
                poem.editor_lock_at = None
            elif action == "unpublish":
                if poem.editor_lock_user_id != request.user.pk:
                    return Response({"detail": "Avval she'rni band qiling."}, status=409)
                poem.status = Poem.Status.EDITING
                poem.published_at = None
            elif action == "edit":
                if poem.editor_lock_user_id != request.user.pk:
                    return Response({"detail": "Avval she'rni band qiling."}, status=409)
                fields = {k: request.data[k] for k in ("title", "content") if k in request.data}
                serializer = PoemSerializer(poem, data=fields, partial=True)
                serializer.is_valid(raise_exception=True)
                content = serializer.validated_data.get("content", poem.content)
                lines = [ln.strip() for ln in content.splitlines() if ln.strip()]
                extra = {"excerpt": "\n".join(lines[:2])}
                if str(request.data.get("edited")).lower() in ("true", "1"):
                    extra["edited"] = True
                serializer.save(**extra)
            elif action in ("hide", "unhide"):
                if request.user.role not in HIDE_ROLES:
                    return Response({"detail": "Bu amal uchun direktor, tahrirchi yoki moderator huquqi kerak."}, status=403)
                poem.is_hidden = action == "hide"
                poem.hidden_reason = str(request.data.get("reason", "")).strip() if action == "hide" else ""
            else:
                return Response({"detail": "Noma'lum amal."}, status=400)
            poem.save()
            AuditLog.objects.create(
                actor=request.user, action=f"poem_{action}", target_type="poem",
                target_id=str(poem.pk), details={"note": request.data.get("note", "")},
            )
        return Response(PoemSerializer(poem).data)