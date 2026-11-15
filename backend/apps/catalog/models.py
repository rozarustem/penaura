from django.conf import settings
from django.db import models
from django.utils.text import slugify


class Book(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Qoralama"
        SUBMITTED = "submitted", "Tahririyatda"
        PUBLISHED = "published", "Nashr qilingan"
        HIDDEN = "hidden", "Yashirilgan"

    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name="books")
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True, allow_unicode=True)
    genre = models.CharField(max_length=60, db_index=True)
    subgenre = models.CharField(max_length=60, blank=True)
    language = models.CharField(max_length=30, default="Uzbek")
    description = models.TextField(blank=True)
    cover = models.ImageField(upload_to="covers/", blank=True)
    tags = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    hidden_reason = models.TextField(blank=True)
    editor_lock_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="locked_books",
    )
    editor_lock_at = models.DateTimeField(null=True, blank=True)
    views = models.PositiveIntegerField(default=0)
    rating = models.FloatField(default=0)
    is_featured = models.BooleanField("Tanlangan asar", default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

    def _make_slug(self):
        clean = self.title
        for ch in ("'", "ʻ", "ʼ", "’", "`"):
            clean = clean.replace(ch, "")
        base = slugify(clean, allow_unicode=True) or "kitob"
        slug, n = base, 2
        while Book.objects.filter(slug=slug).exists():
            slug = f"{base}-{n}"
            n += 1
        return slug

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = self._make_slug()
        super().save(*args, **kwargs)


class Chapter(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Qoralama"
        SUBMITTED = "submitted", "Yuborilgan"
        EDITING = "editing", "Tahrirlanmoqda"
        PUBLISHED = "published", "Nashr qilingan"
        RETURNED = "returned", "Qaytarilgan"

    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="chapters")
    title = models.CharField(max_length=200)
    content = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    is_premium = models.BooleanField(default=False)
    price = models.PositiveSmallIntegerField(default=1)  # necha tanga
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    editor_note = models.TextField(blank=True)
    views = models.PositiveIntegerField(default=0)
    published_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    returned_at = models.DateTimeField(null=True, blank=True)
    edited = models.BooleanField(default=False)
    # Kuzatuvchilarga "yangi bob" xabari yuborilganmi (qayta nashrda takror xabar bormasligi uchun)
    followers_notified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.book.title}: {self.title}"


class BookLike(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="book_likes")
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="likes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "book")


class BookBookmark(models.Model):
    """Foydalanuvchi saqlab qo'ygan kitob (Bookmark). Bir foydalanuvchi — bir kitobga bitta yozuv."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="book_bookmarks")
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="bookmarks")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "book")


class Poem(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Qoralama"
        SUBMITTED = "submitted", "Yuborilgan"
        EDITING = "editing", "Tahrirlanmoqda"
        PUBLISHED = "published", "Nashr qilingan"
        RETURNED = "returned", "Qaytarilgan"

    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name="poems")
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, blank=True, allow_unicode=True)
    topic = models.CharField(max_length=60, default="love", db_index=True)
    genre = models.CharField(max_length=60, default="POETRY")
    excerpt = models.TextField(blank=True)
    content = models.TextField()
    tags = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    editor_note = models.TextField(blank=True)
    edited = models.BooleanField(default=False)
    is_hidden = models.BooleanField(default=False)
    views = models.PositiveIntegerField(default=0)
    rating = models.FloatField(default=0)
    hidden_reason = models.TextField(blank=True)
    editor_lock_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="locked_poems",
    )
    editor_lock_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title.replace("'", "").replace("ʻ", ""), allow_unicode=True) or "sher"
            candidate = base
            suffix = 2
            while Poem.objects.filter(slug=candidate).exclude(pk=self.pk).exists():
                candidate = f"{base}-{suffix}"
                suffix += 1
            self.slug = candidate
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class PoemRating(models.Model):
    """Foydalanuvchining she'rga bergan bahosi (1-5). Bir foydalanuvchi — bir she'rga bitta baho."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="poem_ratings")
    poem = models.ForeignKey(Poem, on_delete=models.CASCADE, related_name="ratings")
    value = models.PositiveSmallIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "poem")
        constraints = [
            models.CheckConstraint(condition=models.Q(value__gte=1, value__lte=5),
                                   name="poemrating_value_1_5"),
        ]


class PoemBookmark(models.Model):
    """Foydalanuvchi saqlab qo'ygan she'r (Bookmark)."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name="poem_bookmarks")
    poem = models.ForeignKey(Poem, on_delete=models.CASCADE, related_name="bookmarks")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "poem")


class Article(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Qoralama"
        PUBLISHED = "published", "Nashr qilingan"

    title = models.CharField(max_length=140)
    slug = models.SlugField(max_length=180, unique=True, blank=True, allow_unicode=True)
    category = models.CharField(max_length=80)
    author_name = models.CharField(max_length=80, default="Penaura Team")
    summary = models.CharField(max_length=300)
    content = models.TextField()
    cover = models.ImageField(upload_to="articles/", blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-published_at", "-created_at"]

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title.replace("'", "").replace("ʻ", ""), allow_unicode=True) or "maqola"
            candidate = base
            suffix = 2
            while Article.objects.filter(slug=candidate).exclude(pk=self.pk).exists():
                candidate = f"{base}-{suffix}"
                suffix += 1
            self.slug = candidate
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title