from django.contrib import admin
from .models import (
    College, AcademicYear, Shift, WorkingDay,
    PeriodSlot, Department, Semester, Section,
    Subject, SectionSubjectRequirement
)

@admin.register(College)
class CollegeAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'email', 'phone')
    search_fields = ('name', 'code')

@admin.register(AcademicYear)
class AcademicYearAdmin(admin.ModelAdmin):
    list_display = ('name', 'college', 'start_date', 'end_date', 'is_current')
    list_filter = ('college', 'is_current')

@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'college', 'start_time', 'end_time', 'is_active')
    list_filter = ('college', 'is_active')

@admin.register(WorkingDay)
class WorkingDayAdmin(admin.ModelAdmin):
    list_display = ('day', 'college', 'order', 'is_active')
    list_filter = ('college', 'is_active')

@admin.register(PeriodSlot)
class PeriodSlotAdmin(admin.ModelAdmin):
    list_display = ('shift', 'day_of_week', 'period_number', 'start_time', 'end_time', 'is_break', 'break_label')
    list_filter = ('shift', 'day_of_week', 'is_break')
    ordering = ('shift', 'day_of_week', 'period_number')

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'college', 'is_active')
    list_filter = ('college', 'is_active')
    search_fields = ('name', 'code')

@admin.register(Semester)
class SemesterAdmin(admin.ModelAdmin):
    list_display = ('department', 'semester_number', 'academic_year', 'shift', 'is_active')
    list_filter = ('academic_year', 'shift', 'department', 'semester_number')

@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ('name', 'semester', 'student_count')
    list_filter = ('semester__department', 'semester__semester_number')
    search_fields = ('name', 'semester__department__code')

@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'department', 'subject_type', 'credits', 'weekly_periods', 'consecutive_slots')
    list_filter = ('department', 'subject_type')
    search_fields = ('code', 'name')

@admin.register(SectionSubjectRequirement)
class SectionSubjectRequirementAdmin(admin.ModelAdmin):
    list_display = ('section', 'subject', 'weekly_periods', 'consecutive_slots')
    list_filter = ('section__semester__department', 'subject__subject_type')
