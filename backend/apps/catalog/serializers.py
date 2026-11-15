import bleach
from rest_framework import serializers

from apps.accounts.models import ChapterUnlock, User

from .models import Article, Book, Chapter, Poem


MIN_CHAPTER_PRICE = 1
MAX_CHAPTER_PRICE = 50


class ChapterListSerializer(serializers.ModelSerializer):
    """Ro'yxat uchun: bob matnisiz."""

    class Meta:
        model = Chapter
        fields = ("id", "title", "order", "is_premium", "price", "status",
                  "editor_note", "views", "published_at", "created_at")


class ChapterSerializer(serializers.ModelSerializer):
    # Yozuvchi faqat qoralama yoki tahririyatga yuborish holatini tanlay oladi.
    # "published", "returned" kabi holatlarni faqat tahririyat o'zgartiradi.
    status = serializers.ChoiceField(
        choices=[("draft", "Qoralama"), ("submitted", "Tahririyatga yuborish")],
        required=False,
    )

    class Meta:
        model = Chapter
        fields = ("id", "title", "content", "order", "is_premium", "price", "status",
                  "editor_note", "views", "published_at", "created_at", "updated_at")
        read_only_fields = ("id", "order", "editor_note", "views", "published_at",
                            "created_at", "updated_at")
        # Pullik bob narxi (tanga): 1 dan 50 gacha. Cheksiz narx qo'yib bo'lmaydi.
        extra_kwargs = {"price": {"min_value": MIN_CHAPTER_PRICE, "max_value": MAX_CHAPTER_PRICE}}

    def validate_content(self, value):
        return bleach.clean(
            value,
            tags=("p", "br", "strong", "em", "b", "i", "u", "blockquote", "h2", "h3",
                  "ul", "ol", "li"),
            attributes={},
            strip=True,
        )

    def validate(self, attrs):
        chapter = self.instance
        if chapter is not None:
            changes_money = any(
                f in attrs and attrs[f] != getattr(chapter, f) for f in ("price", "is_premium"))
            if changes_money and ChapterUnlock.objects.filter(chapter=chapter).exists():
                raise serializers.ValidationError(
                    "Bu bobni o'quvchilar allaqachon sotib olishgan: narxi va pullik/bepul "
                    "holatini o'zgartirib bo'lmaydi.")
        return attrs


class BookSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    likes_count = serializers.SerializerMethodField()
    chapters_count = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = ("id", "slug", "title", "author", "genre", "subgenre", "language",
                  "description", "cover", "tags", "status", "views", "rating",
                  "likes_count", "chapters_count", "is_featured", "created_at", "updated_at")
        read_only_fields = ("id", "slug", "status", "views", "rating", "is_featured",
                            "created_at", "updated_at")

    def get_author(self, obj):
        return {"id": obj.author_id, "full_name": obj.author.full_name}

    def get_likes_count(self, obj):
        v = getattr(obj, "likes_count", None)
        return v if v is not None else obj.likes.count()

    def get_chapters_count(self, obj):
        """Nashr qilingan (saytda ko'rinadigan) boblar soni."""
        v = getattr(obj, "chapters_count", None)
        return v if v is not None else obj.chapters.filter(status="published").count()


class MyBookSerializer(BookSerializer):
    """Yozuvchining "Mening kitoblarim" sahifasi uchun: boblar holati bo'yicha hisob."""
    chapters_total = serializers.SerializerMethodField()
    chapters_review = serializers.SerializerMethodField()
    chapters_returned = serializers.SerializerMethodField()

    class Meta(BookSerializer.Meta):
        fields = BookSerializer.Meta.fields + (
            "chapters_total", "chapters_review", "chapters_returned")

    def _chapters(self, obj):
        # view'da prefetch_related("chapters") bor, shuning uchun qo'shimcha so'rov bo'lmaydi
        return list(obj.chapters.all())

    def get_chapters_total(self, obj):
        return len(self._chapters(obj))

    def get_chapters_review(self, obj):
        return sum(1 for c in self._chapters(obj) if c.status in ("submitted", "editing"))

    def get_chapters_returned(self, obj):
        return sum(1 for c in self._chapters(obj) if c.status == "returned")


class BookDetailSerializer(BookSerializer):
    chapters = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()

    class Meta(BookSerializer.Meta):
        fields = BookSerializer.Meta.fields + ("chapters", "is_saved")

    def get_is_saved(self, obj):
        user = getattr(self.context.get("request"), "user", None)
        return bool(user and user.is_authenticated and obj.bookmarks.filter(user=user).exists())

    def get_chapters(self, obj):
        user = getattr(self.context.get("request"), "user", None)
        qs = obj.chapters.all()
        privileged = user and user.is_authenticated and (
            user.id == obj.author_id or user.role in User.STAFF_ROLES)
        if not privileged:
            qs = qs.filter(status="published")
        return ChapterListSerializer(qs, many=True).data


class PoemSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    status = serializers.ChoiceField(
        choices=[("draft", "Qoralama"), ("submitted", "Tahririyatga yuborish")],
        required=False,
    )

    class Meta:
        model = Poem
        fields = ("id", "slug", "title", "author", "author_id", "topic", "genre", "excerpt",
                  "content", "tags", "status", "editor_note", "views", "rating",
                  "hidden_reason", "is_hidden", "submitted_at", "published_at",
                  "created_at", "updated_at")
        read_only_fields = ("id", "slug", "author", "author_id", "status", "editor_note",
                            "views", "rating", "hidden_reason", "is_hidden", "submitted_at",
                            "published_at", "created_at", "updated_at")

    def get_author(self, obj):
        return {"id": obj.author_id, "full_name": obj.author.full_name}

    def validate_content(self, value):
        return bleach.clean(
            value, tags=("p", "br", "strong", "em", "b", "i", "u", "blockquote"),
            attributes={}, strip=True,
        )


class ArticleSerializer(serializers.ModelSerializer):
    author = serializers.CharField(source="author_name", required=False,
                                   allow_blank=True, max_length=80)
    read_time = serializers.SerializerMethodField()
    status = serializers.ChoiceField(choices=Article.Status.choices, required=False)
    cover = serializers.ImageField(required=False, allow_null=True)
    # Muqovani olib tashlash uchun: remove_cover=1 (multipart yoki JSON)
    remove_cover = serializers.BooleanField(write_only=True, required=False, default=False)

    COVER_MAX_BYTES = 5 * 1024 * 1024

    class Meta:
        model = Article
        fields = ("id", "slug", "title", "category", "author", "summary", "content",
                  "cover", "remove_cover", "status", "read_time", "published_at", "created_at", "updated_at")
        read_only_fields = ("id", "slug", "read_time", "published_at",
                            "created_at", "updated_at")
        # Qoralama to'liq bo'lmasligi mumkin; chop etishda validate() tekshiradi
        extra_kwargs = {"summary": {"allow_blank": True}, "content": {"allow_blank": True}}

    def get_read_time(self, obj):
        words = len(obj.content.split())
        return f"{max(1, (words + 199) // 200)} min read"

    def validate_author(self, value):
        return value.strip() or "Penaura Team"

    def validate_cover(self, value):
        if value and value.size > self.COVER_MAX_BYTES:
            raise serializers.ValidationError("Rasm hajmi 5 MB dan oshmasligi kerak.")
        return value

    def update(self, instance, validated_data):
        remove = validated_data.pop("remove_cover", False)
        new_cover = validated_data.get("cover")
        old_cover = instance.cover
        if remove and not new_cover:
            validated_data["cover"] = ""
        article = super().update(instance, validated_data)
        # eski fayl diskda qolib ketmasligi uchun o'chiramiz
        if old_cover and (remove or new_cover) and old_cover.name != (article.cover.name if article.cover else ""):
            old_cover.delete(save=False)
        return article

    def create(self, validated_data):
        validated_data.pop("remove_cover", None)
        return super().create(validated_data)

    def validate_content(self, value):
        return bleach.clean(
            value,
            tags=("p", "br", "strong", "em", "b", "i", "u", "blockquote", "h2", "h3",
                  "ul", "ol", "li", "a"),
            attributes={"a": ("href", "title")},
            protocols=("http", "https", "mailto"),
            strip=True,
        )

    def validate(self, attrs):
        instance = self.instance
        target = attrs.get("status") or (instance.status if instance else Article.Status.DRAFT)
        if target == Article.Status.PUBLISHED:
            summary = attrs.get("summary", instance.summary if instance else "")
            content = attrs.get("content", instance.content if instance else "")
            if not (summary or "").strip():
                raise serializers.ValidationError({"summary": "Chop etish uchun qisqa tavsif kerak."})
            if not bleach.clean(content or "", tags=(), strip=True).strip():
                raise serializers.ValidationError({"content": "Chop etish uchun maqola matni kerak."})
        return attrs