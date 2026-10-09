from django.contrib import admin
from .models import (
    Faculty, FacultySubjectQualification,
    FacultyAvailability, SectionSubjectAssignment
)


@admin.register(Faculty)
class FacultyAdmin(admin.ModelAdmin):
    list_display = ('employee_id', 'user', 'department', 'designation', 'max_weekly_periods', 'max_daily_periods', 'is_active')
    list_filter = ('department', 'designation', 'is_active')
    search_fields = ('employee_id', 'user__username', 'user__first_name', 'user__last_name', 'user__email')


@admin.register(FacultySubjectQualification)
class FacultySubjectQualificationAdmin(admin.ModelAdmin):
    list_display = ('faculty', 'subject', 'preference_level')
    list_filter = ('faculty__department', 'preference_level')
    search_fields = ('faculty__user__last_name', 'subject__code', 'subject__name')


@admin.register(FacultyAvailability)
class FacultyAvailabilityAdmin(admin.ModelAdmin):
    list_display = ('faculty', 'period_slot', 'is_available', 'reason')
    list_filter = ('is_available', 'period_slot__day_of_week', 'period_slot__shift')
    search_fields = ('faculty__employee_id', 'faculty__user__last_name')


@admin.register(SectionSubjectAssignment)
class SectionSubjectAssignmentAdmin(admin.ModelAdmin):
    list_display = ('section', 'subject', 'faculty', 'is_primary')
    list_filter = ('section__semester__department', 'is_primary')
    search_fields = ('section__name', 'subject__code', 'faculty__user__last_name')
