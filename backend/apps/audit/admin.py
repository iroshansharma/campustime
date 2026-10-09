from django.contrib import admin
from .models import TimetableAuditLog


@admin.register(TimetableAuditLog)
class TimetableAuditLogAdmin(admin.ModelAdmin):
    list_display = ('action', 'timetable', 'user', 'timestamp', 'ip_address')
    list_filter = ('action', 'timestamp')
    search_fields = ('notes', 'user__username', 'timetable__name')
    readonly_fields = ('timestamp',)
