from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User


class UserSerializer(serializers.ModelSerializer):
    followers_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "email", "full_name", "role", "phone", "city", "bio",
                  "avatar", "date_joined", "followers_count", "email_verified")
        read_only_fields = ("id", "email", "role", "date_joined", "followers_count",
                            "email_verified")

    def get_followers_count(self, obj):
        return obj.followers.count()


class AdminUserSerializer(serializers.ModelSerializer):
    """Admin panelda foydalanuvchilar ro'yxati va tafsiloti uchun (parolsiz)."""
    coins = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "email", "full_name", "role", "phone", "city", "bio",
                  "date_joined", "last_login", "is_blocked", "coins")
        read_only_fields = fields

    def get_coins(self, obj):
        wallet = getattr(obj, "wallet", None)
        return wallet.balance if wallet else 0


class PublicWriterSerializer(serializers.ModelSerializer):
    """Yozuvchining ochiq profili (email va telefonsiz)."""
    followers_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "full_name", "role", "bio", "avatar", "followers_count")

    def get_followers_count(self, obj):
        return obj.followers.count()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    role = serializers.ChoiceField(choices=User.PUBLIC_ROLES, default="reader")

    class Meta:
        model = User
        fields = ("full_name", "email", "phone", "password", "role")

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Bu email allaqachon ro'yxatdan o'tgan.")
        return value

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Eski parol noto'g'ri.")
        return value

    def validate_new_password(self, value):
        validate_password(value)
        return value


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class EmailVerifySerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.RegexField(r"^\d{6}$", error_messages={
        "invalid": "Kod 6 ta raqamdan iborat bo'lishi kerak."})


class EmailResendSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        invalid = serializers.ValidationError(
            {"detail": "Havola yaroqsiz yoki muddati tugagan. Yangi havola so'rang."})
        try:
            pk = force_str(urlsafe_base64_decode(attrs["uid"]))
            user = User.objects.get(pk=pk)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise invalid
        if (user.role not in User.PUBLIC_ROLES or not user.is_active
                or not default_token_generator.check_token(user, attrs["token"])):
            raise invalid
        validate_password(attrs["new_password"], user)
        attrs["user"] = user
        return attrs


class SiteTokenSerializer(TokenObtainPairSerializer):
    """Sayt uchun login: faqat o'quvchi va yozuvchi."""
    allowed_roles = User.PUBLIC_ROLES

    def validate(self, attrs):
        data = super().validate(attrs)
        if self.user.is_blocked:
            raise AuthenticationFailed("Akkauntingiz bloklangan.")
        if self.user.role not in self.allowed_roles:
            raise AuthenticationFailed("Email yoki parol noto'g'ri.")
        if self.user.role in User.PUBLIC_ROLES and not self.user.email_verified:
            # Frontend `code` bo'yicha foydalanuvchini tasdiqlash sahifasiga yo'naltiradi.
            raise PermissionDenied({
                "detail": "Emailingiz hali tasdiqlanmagan. Pochtangizga yuborilgan kodni kiriting.",
                "code": "email_not_verified",
            })
        data["user"] = UserSerializer(self.user, context=self.context).data
        return data


class AdminTokenSerializer(SiteTokenSerializer):
    """Admin panel uchun login: faqat xodimlar."""
    allowed_roles = User.STAFF_ROLES