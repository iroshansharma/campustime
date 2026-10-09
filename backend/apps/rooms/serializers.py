from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from .models import Room, RoomAvailability


class RoomSerializer(serializers.ModelSerializer):
    college_name = serializers.CharField(source='college.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True, allow_null=True)
    department_code = serializers.CharField(source='department.code', read_only=True, allow_null=True)
    room_type_display = serializers.CharField(source='get_room_type_display', read_only=True)

    class Meta:
        model = Room
        fields = [
            'id', 'college', 'college_name',
            'department', 'department_name', 'department_code',
            'name', 'code', 'room_type', 'room_type_display',
            'capacity', 'building', 'floor', 'is_active'
        ]

    def validate(self, attrs):
        capacity = attrs.get('capacity', getattr(self.instance, 'capacity', 60))
        if capacity <= 0:
            raise serializers.ValidationError({'capacity': 'Room capacity must be greater than zero.'})

        dept = attrs.get('department')
        college = attrs.get('college', getattr(self.instance, 'college', None))
        if dept and college and dept.college_id != college.id:
            raise serializers.ValidationError({'department': 'Department must belong to the selected college.'})
        return attrs


class RoomAvailabilitySerializer(serializers.ModelSerializer):
    room_code = serializers.CharField(source='room.code', read_only=True)
    period_number = serializers.IntegerField(source='period_slot.period_number', read_only=True)
    day_of_week = serializers.CharField(source='period_slot.day_of_week', read_only=True)
    start_time = serializers.TimeField(source='period_slot.start_time', read_only=True)
    end_time = serializers.TimeField(source='period_slot.end_time', read_only=True)
    is_break = serializers.BooleanField(source='period_slot.is_break', read_only=True)

    class Meta:
        model = RoomAvailability
        fields = [
            'id', 'room', 'room_code', 'period_slot',
            'period_number', 'day_of_week',
            'start_time', 'end_time', 'is_break',
            'is_available', 'reason'
        ]
