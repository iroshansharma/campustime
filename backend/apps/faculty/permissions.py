from rest_framework import permissions
from apps.accounts.models import User


class IsAdminOrFacultyReadOnly(permissions.BasePermission):
    """
    Admins have full CRUD access.
    Faculty members have read-only (SAFE_METHODS) access.
    Students are denied access.
    """
    message = "Students are not permitted to access faculty management data."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.role == User.Role.ADMIN or request.user.is_staff or request.user.is_superuser:
            return True
        if request.user.role == User.Role.FACULTY and request.method in permissions.SAFE_METHODS:
            return True
        return False


class IsAdminOrFacultySelfAvailability(permissions.BasePermission):
    """
    Admins have full access to view and update any faculty's availability.
    Faculty members can view and update only their own availability.
    Students are strictly forbidden.
    """
    message = "Access denied. Only administrators and the faculty member themselves may manage availability."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.role in [User.Role.ADMIN, User.Role.FACULTY] or request.user.is_staff or request.user.is_superuser:
            return True
        return False

    def has_object_permission(self, request, view, obj):
        if request.user.role == User.Role.ADMIN or request.user.is_staff or request.user.is_superuser:
            return True
        if request.user.role == User.Role.FACULTY:
            faculty_obj = getattr(obj, 'faculty', obj)
            return faculty_obj.user == request.user
        return False
