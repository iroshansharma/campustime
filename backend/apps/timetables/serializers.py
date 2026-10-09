from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field

from apps.academics.models import AcademicYear, Shift, Department, Semester, Section, Subject, PeriodSlot
from apps.faculty.models import Faculty
from apps.rooms.models import Room
from apps.timetables.models import Timetable, TimetableEntry


class TimetableEntrySerializer(serializers.ModelSerializer):
    section_name = serializers.CharField(source='section.name', read_only=True)
    subject_code = serializers.CharField(source='subject.code', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_type = serializers.CharField(source='subject.subject_type', read_only=True)
    faculty_name = serializers.SerializerMethodField(read_only=True)
    faculty_employee_id = serializers.CharField(source='faculty.employee_id', read_only=True)
    room_code = serializers.CharField(source='room.code', read_only=True)
    room_name = serializers.CharField(source='room.name', read_only=True)
    room_type = serializers.CharField(source='room.room_type', read_only=True)
    period_number = serializers.IntegerField(source='period_slot.period_number', read_only=True)
    start_time = serializers.TimeField(source='period_slot.start_time', read_only=True)
    end_time = serializers.TimeField(source='period_slot.end_time', read_only=True)

    class Meta:
        model = TimetableEntry
        fields = [
            'id', 'timetable', 'section', 'section_name',
            'subject', 'subject_code', 'subject_name', 'subject_type',
            'faculty', 'faculty_name', 'faculty_employee_id',
            'room', 'room_code', 'room_name', 'room_type',
            'period_slot', 'period_number', 'start_time', 'end_time',
            'day_of_week', 'is_locked', 'linked_session_id',
            'created_at', 'updated_at'
        ]

    @extend_schema_field(serializers.CharField())
    def get_faculty_name(self, obj) -> str:
        u = obj.faculty.user
        full = f"{u.first_name} {u.last_name}".strip()
        return full or u.username


class TimetableSerializer(serializers.ModelSerializer):
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True)
    shift_name = serializers.CharField(source='shift.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    department_code = serializers.CharField(source='department.code', read_only=True)
    semester_name = serializers.CharField(source='semester.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    entries_count = serializers.SerializerMethodField(read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = Timetable
        fields = [
            'id', 'academic_year', 'academic_year_name',
            'shift', 'shift_name',
            'department', 'department_name', 'department_code',
            'semester', 'semester_name',
            'name', 'status', 'status_display', 'version',
            'notes', 'created_by', 'created_by_username',
            'entries_count', 'published_at',
            'created_at', 'updated_at'
        ]

    @extend_schema_field(serializers.IntegerField())
    def get_entries_count(self, obj) -> int:
        return obj.entries.count()


class TimetableDetailSerializer(TimetableSerializer):
    entries = TimetableEntrySerializer(many=True, read_only=True)

    class Meta(TimetableSerializer.Meta):
        fields = TimetableSerializer.Meta.fields + ['entries']


class GenerateScheduleRequestSerializer(serializers.Serializer):
    academic_year_id = serializers.IntegerField(required=True)
    shift_id = serializers.IntegerField(required=False, allow_null=True)
    department_ids = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)
    semester_ids = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)
    section_ids = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)
    timetable_id = serializers.IntegerField(required=False, allow_null=True)
    name = serializers.CharField(required=False, allow_blank=True, max_length=200)
    notes = serializers.CharField(required=False, allow_blank=True)
    max_backtracks = serializers.IntegerField(required=False, default=5000, min_value=100, max_value=50000)
    timeout_seconds = serializers.FloatField(required=False, default=30.0, min_value=1.0, max_value=120.0)
    persist = serializers.BooleanField(required=False, default=True)


class ScheduleConflictSerializer(serializers.Serializer):
    conflict_code = serializers.CharField()
    severity = serializers.CharField()
    message = serializers.CharField()
    section_id = serializers.IntegerField(allow_null=True)
    section_name = serializers.CharField(allow_null=True)
    faculty_id = serializers.IntegerField(allow_null=True)
    faculty_name = serializers.CharField(allow_null=True)
    room_id = serializers.IntegerField(allow_null=True)
    room_name = serializers.CharField(allow_null=True)
    period_slot_ids = serializers.ListField(child=serializers.IntegerField())
    day_of_week = serializers.CharField(allow_null=True)
    subject_code = serializers.CharField(allow_null=True)
    suggested_action = serializers.CharField(allow_null=True)


class ValidationReportSerializer(serializers.Serializer):
    is_valid = serializers.BooleanField()
    total_conflicts = serializers.IntegerField()
    hard_constraint_violations = serializers.IntegerField()
    sessions_required = serializers.IntegerField()
    sessions_scheduled = serializers.IntegerField()
    summary = serializers.CharField()
    conflicts = ScheduleConflictSerializer(many=True)


class DiagnosticBottleneckSerializer(serializers.Serializer):
    category = serializers.CharField()
    summary = serializers.CharField()
    affected_entity = serializers.CharField()
    suggested_action = serializers.CharField()


class GenerationResultSerializer(serializers.Serializer):
    success = serializers.BooleanField()
    status = serializers.CharField()
    message = serializers.CharField()
    timetable_id = serializers.IntegerField(allow_null=True)
    sessions_required = serializers.IntegerField()
    sessions_scheduled = serializers.IntegerField()
    backtracks_count = serializers.IntegerField()
    duration_seconds = serializers.FloatField()
    nodes_explored = serializers.IntegerField()
    validation_report = ValidationReportSerializer(allow_null=True)
    bottlenecks = DiagnosticBottleneckSerializer(many=True)
