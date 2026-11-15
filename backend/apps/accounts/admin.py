from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import AdminUserCreationForm, UserChangeForm

from .models import User


class UserCreationForm(AdminUserCreationForm):
    class Meta:
        model = User
        fields = ("email", "full_name", "role")


class UserEditForm(UserChangeForm):
    class Meta:
        model = User
        fields = "__all__"


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    form = UserEditForm
    add_form = UserCreationForm
    ordering = ("-date_joined",)
    list_display = ("email", "full_name", "role", "is_blocked", "date_joined")
    list_filter = ("role", "is_blocked", "is_staff")
    search_fields = ("email", "full_name", "phone")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Shaxsiy", {"fields": ("full_name", "phone", "city", "bio", "avatar")}),
        ("Rol va holat", {"fields": ("role", "is_blocked", "is_active", "is_staff",
                                     "is_superuser", "groups", "user_permissions")}),
        ("Sanalar", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",),
                "fields": ("email", "full_name", "role", "password1", "password2")}),
    )