from django.contrib import admin
from .models import Timetable, TimetableEntry


class TimetableEntryInline(admin.TabularInline):
    model = TimetableEntry
    extra = 0
    fields = ('section', 'subject', 'faculty', 'room', 'period_slot', 'day_of_week', 'is_locked')
    readonly_fields = ('created_at',)


@admin.register(Timetable)
class TimetableAdmin(admin.ModelAdmin):
    list_display = ('name', 'academic_year', 'shift', 'department', 'semester', 'status', 'version', 'published_at')
    list_filter = ('status', 'shift', 'academic_year', 'department')
    search_fields = ('name', 'notes')
    inlines = [TimetableEntryInline]


@admin.register(TimetableEntry)
class TimetableEntryAdmin(admin.ModelAdmin):
    list_display = ('timetable', 'section', 'subject', 'faculty', 'room', 'period_slot', 'day_of_week', 'is_locked')
    list_filter = ('timetable', 'day_of_week', 'is_locked', 'subject__subject_type')
    search_fields = ('section__name', 'subject__code', 'faculty__user__last_name', 'room__code')
