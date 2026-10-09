from django.contrib import admin
from .models import Room, RoomAvailability


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'room_type', 'capacity', 'department', 'building', 'floor', 'is_active')
    list_filter = ('room_type', 'is_active', 'department')
    search_fields = ('code', 'name', 'building')


@admin.register(RoomAvailability)
class RoomAvailabilityAdmin(admin.ModelAdmin):
    list_display = ('room', 'period_slot', 'is_available', 'reason')
    list_filter = ('is_available', 'period_slot__day_of_week', 'period_slot__shift')
    search_fields = ('room__code', 'room__name')
