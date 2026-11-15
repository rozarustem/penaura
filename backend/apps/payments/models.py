from django.conf import settings
from django.db import models
from django.db.models import Q


class PaymentOrder(models.Model):
    class Provider(models.TextChoices):
        CLICK = "click", "Click"
        PAYME = "payme", "Payme"
        MOCK = "mock", "Test (faqat DEBUG)"

    class Status(models.TextChoices):
        CREATED = "created", "Created"
        PREPARED = "prepared", "Prepared"
        PAID = "paid", "Paid"
        CANCELLED = "cancelled", "Cancelled"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                             related_name="payment_orders")
    provider = models.CharField(max_length=16, choices=Provider.choices)
    package = models.CharField(max_length=16)
    coins = models.PositiveIntegerField()
    bonus_coins = models.PositiveIntegerField(default=0)
    amount_uzs = models.PositiveIntegerField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.CREATED)
    external_id = models.CharField(max_length=64, blank=True)
    wallet_transaction = models.OneToOneField("accounts.WalletTransaction", null=True, blank=True,
                                              on_delete=models.PROTECT,
                                              related_name="payment_order")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "external_id"],
                condition=~Q(external_id=""),
                name="unique_provider_external_id",
            ),
        ]

    @property
    def total_coins(self):
        return self.coins + self.bonus_coins

    def __str__(self):
        return f"#{self.pk} {self.provider} {self.amount_uzs} so'm ({self.status})"
