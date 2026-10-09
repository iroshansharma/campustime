from rest_framework import permissions
from .models import User


class IsAdminUserRole(permissions.BasePermission):
    """
    Grants access only to users with the institutional ADMIN role or superusers.
    """
    message = "Administrative privilege is required to perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (request.user.role == User.Role.ADMIN or request.user.is_staff or request.user.is_superuser)
        )


class IsAdminOrReadOnly(permissions.BasePermission):
    """
    Safe methods (GET, HEAD, OPTIONS) are allowed for any authenticated user.
    Modifying operations (POST, PUT, PATCH, DELETE) require the ADMIN role.
    """
    message = "Read-only access is permitted. Administrative rights required to modify."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(
            request.user.role == User.Role.ADMIN or
            request.user.is_staff or
            request.user.is_superuser
        )


class IsFacultyUserRole(permissions.BasePermission):
    """
    Grants access to authenticated Faculty members.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == User.Role.FACULTY
        )


class IsStudentUserRole(permissions.BasePermission):
    """
    Grants access to authenticated Students.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == User.Role.STUDENT
        )
