from rest_framework import serializers
from drf_spectacular.utils import extend_schema_field
from django.db import transaction
from .models import (
    Faculty, FacultySubjectQualification,
    FacultyAvailability, SectionSubjectAssignment
)
from apps.accounts.models import User
from apps.academics.models import Subject, Section, PeriodSlot


class FacultyUserSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']


class FacultySerializer(serializers.ModelSerializer):
    user_details = FacultyUserSummarySerializer(source='user', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    department_code = serializers.CharField(source='department.code', read_only=True)
    designation_display = serializers.CharField(source='get_designation_display', read_only=True)
    current_weekly_load = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Faculty
        fields = [
            'id', 'user', 'user_details', 'employee_id',
            'department', 'department_name', 'department_code',
            'designation', 'designation_display',
            'max_weekly_periods', 'max_daily_periods',
            'is_active', 'current_weekly_load'
        ]

    @extend_schema_field(serializers.IntegerField())
    def get_current_weekly_load(self, obj) -> int:
        return sum(
            a.subject.weekly_periods
            for a in obj.teaching_assignments.select_related('subject').all()
        )

    def validate(self, attrs):
        max_daily = attrs.get('max_daily_periods') or (self.instance.max_daily_periods if self.instance else None)
        max_weekly = attrs.get('max_weekly_periods') or (self.instance.max_weekly_periods if self.instance else None)

        if max_daily and max_weekly and max_daily > max_weekly:
            raise serializers.ValidationError({
                'max_daily_periods': 'Maximum daily periods cannot exceed maximum weekly periods.'
            })
        return attrs


class FacultySubjectQualificationSerializer(serializers.ModelSerializer):
    faculty_name = serializers.SerializerMethodField(read_only=True)
    faculty_employee_id = serializers.CharField(source='faculty.employee_id', read_only=True)
    subject_code = serializers.CharField(source='subject.code', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_type = serializers.CharField(source='subject.subject_type', read_only=True)

    class Meta:
        model = FacultySubjectQualification
        fields = [
            'id', 'faculty', 'faculty_name', 'faculty_employee_id',
            'subject', 'subject_code', 'subject_name', 'subject_type',
            'preference_level'
        ]

    @extend_schema_field(serializers.CharField())
    def get_faculty_name(self, obj) -> str:
        return obj.faculty.user.get_full_name() or obj.faculty.user.username

    def validate(self, attrs):
        faculty = attrs.get('faculty') or (self.instance.faculty if self.instance else None)
        subject = attrs.get('subject') or (self.instance.subject if self.instance else None)

        if faculty and subject:
            if faculty.department.college_id != subject.department.college_id:
                raise serializers.ValidationError({
                    'faculty': 'Faculty and Subject must belong to the same college/institution.'
                })
        return attrs


class FacultyAvailabilitySerializer(serializers.ModelSerializer):
    period_number = serializers.IntegerField(source='period_slot.period_number', read_only=True)
    day_of_week = serializers.CharField(source='period_slot.day_of_week', read_only=True)
    start_time = serializers.TimeField(source='period_slot.start_time', read_only=True)
    end_time = serializers.TimeField(source='period_slot.end_time', read_only=True)
    is_break = serializers.BooleanField(source='period_slot.is_break', read_only=True)
    break_label = serializers.CharField(source='period_slot.break_label', read_only=True)

    class Meta:
        model = FacultyAvailability
        fields = [
            'id', 'faculty', 'period_slot',
            'period_number', 'day_of_week',
            'start_time', 'end_time', 'is_break', 'break_label',
            'is_available', 'is_preferred', 'reason'
        ]

    def validate(self, attrs):
        period_slot = attrs.get('period_slot') or (self.instance.period_slot if self.instance else None)
        faculty = attrs.get('faculty') or (self.instance.faculty if self.instance else None)
        is_available = attrs.get('is_available', getattr(self.instance, 'is_available', True))

        if period_slot and is_available and period_slot.is_break:
            raise serializers.ValidationError({
                'is_available': 'Cannot set availability to true for a break or recess period.'
            })

        if faculty and period_slot:
            if faculty.department.college_id != period_slot.shift.college_id:
                raise serializers.ValidationError({
                    'period_slot': 'Period slot belongs to a different college than the faculty member.'
                })

        return attrs


class SingleSlotUpdateSerializer(serializers.Serializer):
    period_slot_id = serializers.IntegerField()
    is_available = serializers.BooleanField(default=True)
    is_preferred = serializers.BooleanField(default=False)
    reason = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')


class BatchAvailabilityUpdateSerializer(serializers.Serializer):
    faculty_id = serializers.IntegerField()
    slots = SingleSlotUpdateSerializer(many=True)


class SectionSubjectAssignmentSerializer(serializers.ModelSerializer):
    section_name = serializers.CharField(source='section.name', read_only=True)
    department_code = serializers.CharField(source='section.semester.department.code', read_only=True)
    semester_number = serializers.IntegerField(source='section.semester.semester_number', read_only=True)
    subject_code = serializers.CharField(source='subject.code', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_type = serializers.CharField(source='subject.subject_type', read_only=True)
    weekly_periods = serializers.IntegerField(source='subject.weekly_periods', read_only=True)
    consecutive_slots = serializers.IntegerField(source='subject.consecutive_slots', read_only=True)
    faculty_name = serializers.SerializerMethodField(read_only=True)
    faculty_employee_id = serializers.CharField(source='faculty.employee_id', read_only=True)

    class Meta:
        model = SectionSubjectAssignment
        fields = [
            'id', 'section', 'section_name', 'department_code', 'semester_number',
            'subject', 'subject_code', 'subject_name', 'subject_type',
            'weekly_periods', 'consecutive_slots',
            'faculty', 'faculty_name', 'faculty_employee_id', 'is_primary'
        ]

    @extend_schema_field(serializers.CharField())
    def get_faculty_name(self, obj) -> str:
        return obj.faculty.user.get_full_name() or obj.faculty.user.username

    def validate(self, attrs):
        instance = SectionSubjectAssignment(**attrs)
        if self.instance:
            instance.pk = self.instance.pk
        instance.clean()
        return attrs
