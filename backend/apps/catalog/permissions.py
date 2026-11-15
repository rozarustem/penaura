from rest_framework import permissions


class IsWriter(permissions.BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.role == "writer")


class IsStaffRole(permissions.BasePermission):
    allowed_roles = ()

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role in self.allowed_roles)


class IsEditorialStaff(IsStaffRole):
    allowed_roles = ("direktor", "tahrirchi")


class IsContentStaff(IsStaffRole):
    """Asarlarni ko'ra oladiganlar: direktor, tahrirchi va moderator (moderator faqat ko'radi va yashiradi)."""
    allowed_roles = ("direktor", "tahrirchi", "moderator")


class IsModeratorStaff(IsStaffRole):
    allowed_roles = ("direktor", "moderator")


class IsDirector(IsStaffRole):
    allowed_roles = ("direktor",)


class IsOwnerOrReadOnly(permissions.BasePermission):
    """O'qish hammaga; o'zgartirish va o'chirish faqat egasiga."""

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        owner_id = obj.author_id if hasattr(obj, "author_id") else obj.book.author_id
        return request.user.is_authenticated and owner_id == request.user.id