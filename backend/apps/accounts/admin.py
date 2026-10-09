from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, StudentProfile


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'role', 'is_staff', 'is_active')
    list_filter = ('role', 'is_staff', 'is_active')
    fieldsets = BaseUserAdmin.fieldsets + (
        ('CampusTime Institutional Info', {'fields': ('role', 'phone_number', 'is_verified')}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('CampusTime Institutional Info', {'fields': ('role', 'email', 'phone_number')}),
    )
    search_fields = ('username', 'email', 'first_name', 'last_name')


@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = ('enrollment_number', 'user', 'department', 'section', 'batch_year')
    search_fields = ('enrollment_number', 'user__username', 'user__email')
    list_filter = ('department', 'batch_year')
