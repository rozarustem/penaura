from django.contrib import admin

from .models import PaymentOrder


@admin.register(PaymentOrder)
class PaymentOrderAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "provider", "amount_uzs", "total_coins", "status", "created_at", "paid_at")
    list_filter = ("provider", "status")
    search_fields = ("user__email", "external_id")
    readonly_fields = [field.name for field in PaymentOrder._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
