from django.contrib import admin
from django.utils import timezone

from .models import Book, Chapter


class ChapterInline(admin.TabularInline):
    model = Chapter
    fields = ("title", "order", "is_premium", "status")
    extra = 0
    show_change_link = True


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "genre", "status", "views", "created_at")
    list_filter = ("status", "genre", "language")
    search_fields = ("title", "author__full_name", "author__email")
    inlines = [ChapterInline]


@admin.register(Chapter)
class ChapterAdmin(admin.ModelAdmin):
    list_display = ("title", "book", "order", "is_premium", "status")
    list_filter = ("status", "is_premium")
    search_fields = ("title", "book__title")
    actions = ["publish_selected"]

    @admin.action(description="Tanlangan boblarni nashr qilish")
    def publish_selected(self, request, queryset):
        for ch in queryset.select_related("book"):
            ch.status = Chapter.Status.PUBLISHED
            ch.published_at = timezone.now()
            ch.save()
            if ch.book.status != Book.Status.PUBLISHED:
                ch.book.status = Book.Status.PUBLISHED
                ch.book.save()