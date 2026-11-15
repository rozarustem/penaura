import logging
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView

from . import email_verification
from .models import AuditLog, ChapterUnlock, ReadingProgress, User, Wallet, WalletTransaction
from .serializers import (AdminTokenSerializer, AdminUserSerializer, ChangePasswordSerializer,
                          EmailResendSerializer, EmailVerifySerializer,
                          PasswordResetConfirmSerializer, PasswordResetRequestSerializer,
                          PublicWriterSerializer, RegisterSerializer, SiteTokenSerializer,
                          UserSerializer)

logger = logging.getLogger(__name__)


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "register"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        Wallet.objects.get_or_create(user=user)
        # Kod yuborilmasa ham ro'yxatdan o'tish bekor bo'lmaydi: foydalanuvchi "qayta yuborish"ni bosadi.
        email_verification.send_code(user)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class VerifyEmailView(generics.GenericAPIView):
    """POST /api/auth/verify-email/ {"email", "code"}"""
    serializer_class = EmailVerifySerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "email_verify"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()
        code = serializer.validated_data["code"]
        user = User.objects.filter(email__iexact=email, is_active=True, is_blocked=False,
                                   role__in=User.PUBLIC_ROLES).first()
        if user is None:
            return self._invalid()
        if user.email_verified:
            return Response({"detail": "Email allaqachon tasdiqlangan. Kirishingiz mumkin."})
        result = email_verification.check_code(user, code)
        if result == email_verification.OK:
            return Response({"detail": "Email tasdiqlandi. Endi kirishingiz mumkin."})
        if result == email_verification.EXPIRED:
            return self._invalid("Kodning muddati tugagan. Yangi kod so'rang.")
        if result == email_verification.LOCKED:
            return self._invalid("Juda ko'p noto'g'ri urinish. Yangi kod so'rang.")
        return self._invalid()

    @staticmethod
    def _invalid(message="Kod noto'g'ri."):
        return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)


class ResendVerificationView(generics.GenericAPIView):
    """POST /api/auth/resend-verification/ {"email"}

    Email ro'yxatdan o'tgan-o'tmaganidan qat'i nazar bir xil javob qaytaradi.
    Bir foydalanuvchiga 60 soniyada bir martadan ko'p kod yuborilmaydi.
    """
    serializer_class = EmailResendSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "email_resend"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()
        user = User.objects.filter(email__iexact=email, is_active=True, is_blocked=False,
                                   role__in=User.PUBLIC_ROLES, email_verified=False).first()
        if user and email_verification.can_send(user):
            email_verification.send_code(user)
        return Response({"detail": "Agar bu email tasdiqlanmagan bo'lsa, yangi kod yuborildi."})


class LoginView(TokenObtainPairView):
    serializer_class = SiteTokenSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"


class AdminLoginView(TokenObtainPairView):
    serializer_class = AdminTokenSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            AuditLog.objects.create(
                actor_id=response.data.get("user", {}).get("id"),
                action="admin_login",
                details={"email": request.data.get("email", "")},
            )
        return response


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class PublicWriterView(generics.RetrieveAPIView):
    """Yozuvchining ochiq profili: GET /api/auth/writers/<id>/"""
    serializer_class = PublicWriterSerializer
    permission_classes = [permissions.AllowAny]
    queryset = User.objects.filter(role=User.Role.WRITER)


class SpotlightWriterView(generics.GenericAPIView):
    """Oy muallifi: GET /api/auth/spotlight/ -> {"id": <yozuvchi id> yoki null}"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        pk = (User.objects.filter(is_spotlight=True, role=User.Role.WRITER,
                                  is_active=True, is_blocked=False)
              .values_list("pk", flat=True).first())
        return Response({"id": pk})


class ChangePasswordView(generics.GenericAPIView):
    serializer_class = ChangePasswordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save()
        return Response({"detail": "Parol o'zgartirildi."})


class DeleteAccountView(generics.GenericAPIView):
    """Hisobni o'chirish: POST /api/auth/delete-account/ {"password": "..."}

    Bazadan butunlay o'chirilmaydi (tanga tranzaksiyalari PROTECT bilan himoyalangan):
    hisob faolsizlantiriladi, shaxsiy ma'lumotlar tozalanadi, email bo'shatiladi.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role not in User.PUBLIC_ROLES:
            raise PermissionDenied("Xodim akkauntini bu yerdan o'chirib bo'lmaydi.")
        password = request.data.get("password", "")
        if not password or not user.check_password(password):
            return Response({"password": ["Parol noto'g'ri."]},
                            status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            user_id = user.pk
            user.following.all().delete()
            user.followers.all().delete()
            ReadingProgress.objects.filter(user=user).delete()
            if user.avatar:
                user.avatar.delete(save=False)
            user.email = f"deleted-{user_id}@deleted.invalid"
            user.full_name = "O'chirilgan foydalanuvchi"
            user.phone = ""
            user.city = ""
            user.bio = ""
            user.avatar = ""
            user.is_active = False
            user.set_unusable_password()
            user.save()
            AuditLog.objects.create(action="account_deleted", target_type="user",
                                    target_id=str(user_id), details={})
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordResetRequestView(generics.GenericAPIView):
    """POST /api/auth/password-reset/ {"email": "..."}

    Email ro'yxatdan o'tgan-o'tmaganidan qat'i nazar har doim bir xil javob qaytaradi.
    """
    serializer_class = PasswordResetRequestSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()
        user = User.objects.filter(email__iexact=email, is_active=True,
                                   role__in=User.PUBLIC_ROLES, is_blocked=False).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            link = f"{settings.FRONTEND_URL}reset-password.html?uid={uid}&token={token}"
            try:
                send_mail(
                    "Penaura: parolni tiklash",
                    f"Salom, {user.full_name}!\n\n"
                    f"Parolingizni tiklash uchun quyidagi havolaga o'ting (1 soat amal qiladi):\n\n"
                    f"{link}\n\n"
                    f"Agar buni siz so'ramagan bo'lsangiz, bu xatni e'tiborsiz qoldiring.",
                    settings.DEFAULT_FROM_EMAIL, [user.email],
                )
            except Exception:
                logger.exception("Parol tiklash xatini yuborib bo'lmadi")
        return Response({"detail": "Agar bu email ro'yxatdan o'tgan bo'lsa, parolni tiklash havolasi yuborildi."})


class PasswordResetConfirmView(generics.GenericAPIView):
    """POST /api/auth/password-reset/confirm/ {"uid", "token", "new_password"}"""
    serializer_class = PasswordResetConfirmSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset_confirm"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        user.set_password(serializer.validated_data["new_password"])
        user.save()
        AuditLog.objects.create(actor=user, action="password_reset", target_type="user",
                                target_id=str(user.pk), details={})
        return Response({"detail": "Parol yangilandi. Endi kirishingiz mumkin."})


class WalletView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        wallet, _ = Wallet.objects.get_or_create(user=request.user)
        rows = wallet.transactions.all()[:50]
        return Response({
            "balance": wallet.balance,
            "transactions": [
                {"id": row.id, "kind": row.kind, "amount": row.amount,
                 "balance_after": row.balance_after, "reference": row.reference,
                 "created_at": row.created_at}
                for row in rows
            ],
        })


class AdminUserPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 200


def _real_users():
    """O'chirilgan (anonimlashtirilgan) hisoblarsiz foydalanuvchilar."""
    return User.objects.exclude(email__endswith="@deleted.invalid")


class AdminUserListView(generics.ListAPIView):
    """GET /api/auth/admin/users/?search=&role=&page=&page_size=

    Javobga umumiy statistika (`stats`) ham qo'shiladi. Faqat direktor va moderator.
    """
    serializer_class = AdminUserSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = AdminUserPagination

    def get_queryset(self):
        if self.request.user.role not in ("direktor", "moderator"):
            raise PermissionDenied("Foydalanuvchilar ro'yxatiga ruxsatingiz yo'q.")
        qs = _real_users().select_related("wallet").order_by("-date_joined", "-id")
        role = self.request.query_params.get("role", "").strip()
        if role:
            qs = qs.filter(role=role)
        term = self.request.query_params.get("search", "").strip()
        if term:
            qs = qs.filter(Q(full_name__icontains=term) | Q(email__icontains=term)
                           | Q(phone__icontains=term))
        return qs

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        users = _real_users()
        today = timezone.localtime().replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday = today - timedelta(days=1)
        response.data["stats"] = {
            "writers": users.filter(role=User.Role.WRITER).count(),
            "readers": users.filter(role=User.Role.READER).count(),
            "staff": users.filter(role__in=User.STAFF_ROLES).count(),
            "blocked": users.filter(is_blocked=True).count(),
            "joined_today": users.filter(date_joined__gte=today).count(),
            "joined_yesterday": users.filter(date_joined__gte=yesterday,
                                             date_joined__lt=today).count(),
        }
        return response


class AdminUserDetailView(generics.GenericAPIView):
    serializer_class = AdminUserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        if self.request.user.role not in ("direktor", "moderator"):
            raise PermissionDenied("Bu amal uchun ruxsatingiz yo'q.")
        return get_object_or_404(_real_users().select_related("wallet"), pk=self.kwargs["pk"])

    def get(self, request, *args, **kwargs):
        user = self.get_object()
        data = dict(AdminUserSerializer(user).data)
        wallet = getattr(user, "wallet", None)
        data["books_count"] = user.books.count()
        data["poems_count"] = user.poems.count()
        data["chapters_unlocked"] = ChapterUnlock.objects.filter(user=user).count()
        data["followers_count"] = user.followers.count()
        data["transactions"] = [
            {"id": t.id, "kind": t.kind, "amount": t.amount, "balance_after": t.balance_after,
             "reference": t.reference, "created_at": t.created_at}
            for t in (wallet.transactions.all()[:30] if wallet else [])
        ]
        # Audit yozuvlari faqat direktorga ko'rinadi (audit jurnali bilan bir xil qoida)
        data["audit"] = []
        if request.user.role == "direktor":
            rows = AuditLog.objects.select_related("actor").filter(
                Q(target_type="user", target_id=str(user.pk)) | Q(actor=user))[:30]
            data["audit"] = [
                {"id": r.id, "created_at": r.created_at,
                 "actor": r.actor.full_name if r.actor else "",
                 "action": r.action, "target_type": r.target_type,
                 "target_id": r.target_id, "details": r.details}
                for r in rows
            ]
        return Response(data)

    def post(self, request, *args, **kwargs):
        user = self.get_object()
        if user.role in User.STAFF_ROLES:
            raise PermissionDenied("Xodim akkauntini bu amal bilan bloklab bo'lmaydi.")
        blocked = request.data.get("is_blocked")
        if not isinstance(blocked, bool):
            return Response({"is_blocked": ["Boolean qiymat yuboring."]},
                            status=status.HTTP_400_BAD_REQUEST)
        user.is_blocked = blocked
        user.save(update_fields=["is_blocked"])
        AuditLog.objects.create(
            actor=request.user, action="user_blocked" if blocked else "user_unblocked",
            target_type="user", target_id=str(user.pk),
            details={"email": user.email, "name": user.full_name},
        )
        return Response(AdminUserSerializer(user).data)


class AdminUserRoleView(generics.GenericAPIView):
    """POST /api/auth/admin/users/<id>/role/  {"role": "moderator"}

    Faqat direktor. O'z rolini o'zgartira olmaydi (shuning uchun kamida bitta direktor har doim qoladi).
    Rol har so'rovda bazadan o'qiladi, shuning uchun o'zgarish darhol kuchga kiradi. Audit: user_role_changed.
    """
    serializer_class = AdminUserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        if request.user.role != User.Role.DIREKTOR:
            raise PermissionDenied("Rolni faqat direktor o'zgartira oladi.")
        new_role = request.data.get("role")
        if not isinstance(new_role, str) or new_role not in User.Role.values:
            return Response({"role": ["Noto'g'ri rol."]}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            user = get_object_or_404(_real_users().select_for_update(), pk=self.kwargs["pk"])
            if user.pk == request.user.pk:
                raise PermissionDenied("O'z rolingizni o'zgartira olmaysiz.")
            if user.role == new_role:
                return Response({"role": ["Foydalanuvchi allaqachon shu rolda."]},
                                status=status.HTTP_400_BAD_REQUEST)
            if user.is_blocked and new_role in User.STAFF_ROLES:
                return Response({"role": ["Bloklangan foydalanuvchiga xodim roli berib bo'lmaydi. Avval blokdan chiqaring."]},
                                status=status.HTTP_400_BAD_REQUEST)
            old_role = user.role
            user.role = new_role
            user.save(update_fields=["role"])
            AuditLog.objects.create(
                actor=request.user, action="user_role_changed",
                target_type="user", target_id=str(user.pk),
                details={"email": user.email, "name": user.full_name,
                         "from_role": old_role, "to_role": new_role},
            )
        return Response(AdminUserSerializer(user).data)


class WalletAdjustmentView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        if request.user.role not in ("direktor", "moliyachi"):
            raise PermissionDenied("Faqat moliyachi yoki direktor balansni o'zgartira oladi.")
        try:
            user_id = int(request.data["user_id"])
            amount = int(request.data["amount"])
        except (KeyError, TypeError, ValueError):
            return Response({"detail": "user_id va musbat amount yuborilishi kerak."},
                            status=status.HTTP_400_BAD_REQUEST)
        if amount <= 0:
            return Response({"amount": ["Miqdor noldan katta bo'lishi kerak."]},
                            status=status.HTTP_400_BAD_REQUEST)
        if amount > settings.WALLET_ADJUSTMENT_MAX_COINS:
            return Response({"amount": [
                f"Bir marta eng ko'pi bilan {settings.WALLET_ADJUSTMENT_MAX_COINS} tanga qo'shish mumkin."]},
                status=status.HTTP_400_BAD_REQUEST)
        # Moliyachi faqat kichik summani o'zi qo'sha oladi; kattasini direktor tasdiqlaydi.
        if (amount > settings.WALLET_ADJUSTMENT_FINANCE_LIMIT_COINS
                and request.user.role != "direktor"):
            raise PermissionDenied(
                f"{settings.WALLET_ADJUSTMENT_FINANCE_LIMIT_COINS} tangadan ko'p qo'shishni "
                "faqat direktor bajaradi.")
        if user_id == request.user.pk:
            raise PermissionDenied("O'z hisobingizga tanga qo'sha olmaysiz.")
        reference = str(request.data.get("reference", "")).strip()[:120]
        if not reference:
            return Response({"reference": ["Sabab yoki manba ko'rsatilishi kerak."]},
                            status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            user = get_object_or_404(User.objects.select_for_update(), pk=user_id, is_active=True)
            wallet, _ = Wallet.objects.select_for_update().get_or_create(user=user)
            wallet.balance += amount
            wallet.save(update_fields=["balance", "updated_at"])
            row = WalletTransaction.objects.create(
                wallet=wallet, kind=WalletTransaction.Kind.ADJUSTMENT,
                amount=amount, balance_after=wallet.balance, reference=reference,
            )
            AuditLog.objects.create(
                actor=request.user, action="wallet_credit", target_type="user",
                target_id=str(user.pk),
                details={"amount": amount, "reference": reference, "transaction_id": row.pk},
            )
        return Response({"balance": wallet.balance, "transaction_id": row.pk},
                        status=status.HTTP_201_CREATED)


class AuditLogListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        if request.user.role != "direktor":
            raise PermissionDenied("Audit jurnaliga faqat direktor kira oladi.")
        rows = AuditLog.objects.select_related("actor")[:500]
        return Response([
            {"id": row.id, "created_at": row.created_at, "actor": row.actor.full_name if row.actor else "",
             "actor_role": row.actor.role if row.actor else "", "action": row.action,
             "target_type": row.target_type, "target_id": row.target_id, "details": row.details}
            for row in rows
        ])