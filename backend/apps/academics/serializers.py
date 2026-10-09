from rest_framework import serializers
from .models import (
    College, AcademicYear, Shift, WorkingDay,
    PeriodSlot, Department, Semester, Section, Subject
)


class CollegeSerializer(serializers.ModelSerializer):
    class Meta:
        model = College
        fields = ['id', 'name', 'code', 'address', 'email', 'phone', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class AcademicYearSerializer(serializers.ModelSerializer):
    college_name = serializers.CharField(source='college.name', read_only=True)

    class Meta:
        model = AcademicYear
        fields = ['id', 'college', 'college_name', 'name', 'start_date', 'end_date', 'is_current']
        read_only_fields = ['id', 'college_name']

    def validate(self, attrs):
        start = attrs.get('start_date') or (self.instance.start_date if self.instance else None)
        end = attrs.get('end_date') or (self.instance.end_date if self.instance else None)
        if start and end and start >= end:
            raise serializers.ValidationError({'end_date': 'End date must be strictly after start date.'})
        return attrs


class ShiftSerializer(serializers.ModelSerializer):
    college_name = serializers.CharField(source='college.name', read_only=True)

    class Meta:
        model = Shift
        fields = ['id', 'college', 'college_name', 'name', 'code', 'start_time', 'end_time', 'is_active']
        read_only_fields = ['id', 'college_name']

    def validate(self, attrs):
        start = attrs.get('start_time') or (self.instance.start_time if self.instance else None)
        end = attrs.get('end_time') or (self.instance.end_time if self.instance else None)
        if start and end and start >= end:
            raise serializers.ValidationError({'end_time': 'End time must be strictly after start time.'})
        return attrs


class WorkingDaySerializer(serializers.ModelSerializer):
    day_display = serializers.CharField(source='get_day_display', read_only=True)

    class Meta:
        model = WorkingDay
        fields = ['id', 'college', 'day', 'day_display', 'order', 'is_active']
        read_only_fields = ['id', 'day_display']


class PeriodSlotSerializer(serializers.ModelSerializer):
    shift_name = serializers.CharField(source='shift.name', read_only=True)
    day_of_week_display = serializers.CharField(source='get_day_of_week_display', read_only=True)

    class Meta:
        model = PeriodSlot
        fields = [
            'id', 'shift', 'shift_name', 'day_of_week', 'day_of_week_display',
            'period_number', 'start_time', 'end_time', 'is_break', 'break_label'
        ]
        read_only_fields = ['id', 'shift_name', 'day_of_week_display']

    def validate(self, attrs):
        start = attrs.get('start_time') or (self.instance.start_time if self.instance else None)
        end = attrs.get('end_time') or (self.instance.end_time if self.instance else None)
        if start and end and start >= end:
            raise serializers.ValidationError({'end_time': 'Period end time must be after start time.'})
        return attrs


class DepartmentSerializer(serializers.ModelSerializer):
    college_name = serializers.CharField(source='college.name', read_only=True)

    class Meta:
        model = Department
        fields = ['id', 'college', 'college_name', 'name', 'code', 'is_active']
        read_only_fields = ['id', 'college_name']


class SemesterSerializer(serializers.ModelSerializer):
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    department_code = serializers.CharField(source='department.code', read_only=True)
    shift_name = serializers.CharField(source='shift.name', read_only=True)

    class Meta:
        model = Semester
        fields = [
            'id', 'academic_year', 'academic_year_name',
            'department', 'department_name', 'department_code',
            'semester_number', 'shift', 'shift_name', 'is_active'
        ]
        read_only_fields = ['id', 'academic_year_name', 'department_name', 'department_code', 'shift_name']

    def validate(self, attrs):
        ay = attrs.get('academic_year') or (self.instance.academic_year if self.instance else None)
        dept = attrs.get('department') or (self.instance.department if self.instance else None)
        shift = attrs.get('shift') or (self.instance.shift if self.instance else None)
        sem_num = attrs.get('semester_number') or (self.instance.semester_number if self.instance else None)

        if sem_num is not None and not (1 <= sem_num <= 12):
            raise serializers.ValidationError({'semester_number': 'Semester number must be between 1 and 12.'})

        # Cross-college validation
        if ay and dept and ay.college_id != dept.college_id:
            raise serializers.ValidationError({
                'department': f"Department '{dept.code}' does not belong to College '{ay.college.name}'."
            })
        if shift and dept and shift.college_id != dept.college_id:
            raise serializers.ValidationError({
                'shift': f"Shift '{shift.name}' does not belong to College '{dept.college.name}'."
            })

        return attrs


from drf_spectacular.utils import extend_schema_field

class SectionSerializer(serializers.ModelSerializer):
    semester_info = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Section
        fields = ['id', 'semester', 'semester_info', 'name', 'student_count']
        read_only_fields = ['id', 'semester_info']

    @extend_schema_field(serializers.DictField)
    def get_semester_info(self, obj):
        return {
            'id': obj.semester.id,
            'department_code': obj.semester.department.code,
            'semester_number': obj.semester.semester_number,
            'shift_name': obj.semester.shift.name,
        }

    def validate_student_count(self, value):
        if value <= 0:
            raise serializers.ValidationError('Student count must be greater than zero.')
        return value


class SubjectSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    department_code = serializers.CharField(source='department.code', read_only=True)
    subject_type_display = serializers.CharField(source='get_subject_type_display', read_only=True)

    class Meta:
        model = Subject
        fields = [
            'id', 'department', 'department_name', 'department_code',
            'code', 'name', 'subject_type', 'subject_type_display',
            'credits', 'weekly_periods', 'consecutive_slots'
        ]
        read_only_fields = ['id', 'department_name', 'department_code', 'subject_type_display']

    def validate(self, attrs):
        weekly = attrs.get('weekly_periods') or (self.instance.weekly_periods if self.instance else None)
        consec = attrs.get('consecutive_slots') or (self.instance.consecutive_slots if self.instance else 1)

        if weekly is not None and weekly <= 0:
            raise serializers.ValidationError({'weekly_periods': 'Weekly periods must be greater than zero.'})
        if consec is not None and consec <= 0:
            raise serializers.ValidationError({'consecutive_slots': 'Consecutive slots must be greater than zero.'})
        if weekly and consec and consec > weekly:
            raise serializers.ValidationError({'consecutive_slots': 'Consecutive slots cannot exceed weekly periods.'})
        if weekly and consec and weekly % consec != 0:
            raise serializers.ValidationError({
                'consecutive_slots': f"Weekly periods ({weekly}) must be divisible by consecutive slot block size ({consec})."
            })
        return attrs
