from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("Email majburiy")
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("role", User.Role.DIREKTOR)
        extra.setdefault("email_verified", True)
        return self._create_user(email, password, **extra)


class User(AbstractUser):
    class Role(models.TextChoices):
        READER = "reader", "O'quvchi"
        WRITER = "writer", "Yozuvchi"
        DIREKTOR = "direktor", "Direktor"
        MOLIYACHI = "moliyachi", "Moliyachi"
        MODERATOR = "moderator", "Moderator"
        TAHRIRCHI = "tahrirchi", "Tahrirchi"

    STAFF_ROLES = ("direktor", "moliyachi", "moderator", "tahrirchi")
    PUBLIC_ROLES = ("reader", "writer")

    username = None
    first_name = None
    last_name = None

    email = models.EmailField("Email", unique=True)
    full_name = models.CharField("To'liq ism", max_length=150)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.READER)
    phone = models.CharField(max_length=20, blank=True)
    city = models.CharField(max_length=80, blank=True)
    bio = models.TextField(blank=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True)
    is_blocked = models.BooleanField("Bloklangan", default=False)
    is_spotlight = models.BooleanField("Oy muallifi", default=False)
    email_verified = models.BooleanField("Email tasdiqlangan", default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    objects = UserManager()

    def __str__(self):
        return f"{self.full_name} <{self.email}>"

    @property
    def is_staff_role(self):
        return self.role in self.STAFF_ROLES


class Wallet(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="wallet")
    balance = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.email}: {self.balance}"


class WalletTransaction(models.Model):
    class Kind(models.TextChoices):
        ADJUSTMENT = "adjustment", "Manual adjustment"
        CHAPTER_UNLOCK = "chapter_unlock", "Chapter unlock"
        PURCHASE = "purchase", "Coin purchase"

    wallet = models.ForeignKey(Wallet, on_delete=models.PROTECT, related_name="transactions")
    kind = models.CharField(max_length=30, choices=Kind.choices)
    amount = models.PositiveIntegerField()
    balance_after = models.PositiveIntegerField()
    reference = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class ChapterUnlock(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="chapter_unlocks")
    chapter = models.ForeignKey("catalog.Chapter", on_delete=models.CASCADE,
                                related_name="unlocks")
    transaction = models.OneToOneField(WalletTransaction, on_delete=models.PROTECT,
                                       related_name="chapter_unlock")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("user", "chapter"), name="unique_user_chapter_unlock")
        ]


class RevenueSplit(models.Model):
    """Bob ochilgan zahoti pul yozuvchi va platforma o'rtasida bo'linadi (masalan, 70/30).

    Foiz va kurs shu paytdagi qiymat bilan saqlanadi, shuning uchun keyinchalik sozlama
    o'zgarsa ham eski yozuvlar o'zgarmaydi.
    """

    unlock = models.OneToOneField(ChapterUnlock, on_delete=models.PROTECT,
                                  related_name="split")
    reader = models.ForeignKey(User, on_delete=models.PROTECT, related_name="paid_splits")
    writer = models.ForeignKey(User, on_delete=models.PROTECT, related_name="earnings")
    chapter = models.ForeignKey("catalog.Chapter", on_delete=models.PROTECT,
                                related_name="splits")
    coins = models.PositiveIntegerField()
    rate_som = models.PositiveIntegerField()
    writer_percent = models.PositiveSmallIntegerField()
    gross_som = models.PositiveIntegerField()
    writer_som = models.PositiveIntegerField()
    platform_som = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["writer", "-created_at"])]


class WithdrawalRequest(models.Model):
    """Yozuvchining pulni yechib olish so'rovi (demo: haqiqiy o'tkazma yo'q)."""

    class Status(models.TextChoices):
        PENDING = "pending", "Kutilmoqda"
        PAID = "paid", "To'langan"
        REJECTED = "rejected", "Rad etilgan"

    writer = models.ForeignKey(User, on_delete=models.PROTECT, related_name="withdrawals")
    amount_som = models.PositiveIntegerField()
    card_last4 = models.CharField(max_length=4)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    reject_reason = models.CharField(max_length=200, blank=True)
    processed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name="processed_withdrawals")
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class ReadingProgress(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="reading_progress")
    book = models.ForeignKey("catalog.Book", on_delete=models.CASCADE, related_name="reading_progress")
    chapter = models.ForeignKey("catalog.Chapter", on_delete=models.SET_NULL, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("user", "book"), name="unique_user_book_progress")
        ]


class Follow(models.Model):
    follower = models.ForeignKey(User, on_delete=models.CASCADE, related_name="following")
    writer = models.ForeignKey(User, on_delete=models.CASCADE, related_name="followers")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("follower", "writer"), name="unique_user_follow")
        ]


class AuditLog(models.Model):
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                              related_name="audit_actions")
    action = models.CharField(max_length=120)
    target_type = models.CharField(max_length=80, blank=True)
    target_id = models.CharField(max_length=80, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class EmailVerificationCode(models.Model):
    """Foydalanuvchining joriy email tasdiqlash kodi (faqat xesh saqlanadi, bitta faol kod)."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="email_code")
    code_hash = models.CharField(max_length=64)
    sent_at = models.DateTimeField(default=timezone.now)
    attempts = models.PositiveSmallIntegerField(default=0)

    def __str__(self):
        return f"Tasdiqlash kodi: {self.user.email}"



class Notification(models.Model):
    """Foydalanuvchiga sayt ichida ko'rinadigan xabar (masalan, kuzatilgan yozuvchi yangi bob chiqardi)."""

    class Kind(models.TextChoices):
        NEW_CHAPTER = "new_chapter", "Yangi bob"
        NEW_BOOK = "new_book", "Yangi kitob"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=20, choices=Kind.choices)
    message = models.CharField(max_length=255)
    book = models.ForeignKey("catalog.Book", on_delete=models.SET_NULL, null=True, blank=True,
                             related_name="notifications")
    chapter = models.ForeignKey("catalog.Chapter", on_delete=models.SET_NULL, null=True,
                                blank=True, related_name="notifications")
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["user", "is_read", "-created_at"])]