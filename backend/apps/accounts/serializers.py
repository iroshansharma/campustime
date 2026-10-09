from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User, StudentProfile


class FacultySummarySerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    employee_id = serializers.CharField(read_only=True)
    designation = serializers.CharField(read_only=True)
    department_id = serializers.IntegerField(source='department.id', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    department_code = serializers.CharField(source='department.code', read_only=True)
    max_weekly_periods = serializers.IntegerField(read_only=True)
    max_daily_periods = serializers.IntegerField(read_only=True)


class StudentSummarySerializer(serializers.ModelSerializer):
    department_id = serializers.IntegerField(source='department.id', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    department_code = serializers.CharField(source='department.code', read_only=True)
    section_id = serializers.IntegerField(source='section.id', read_only=True)
    section_name = serializers.CharField(source='section.name', read_only=True)

    class Meta:
        model = StudentProfile
        fields = [
            'id', 'enrollment_number', 'batch_year',
            'department_id', 'department_name', 'department_code',
            'section_id', 'section_name'
        ]


from drf_spectacular.utils import extend_schema_field

class UserSerializer(serializers.ModelSerializer):
    faculty_profile = serializers.SerializerMethodField()
    student_profile = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'phone_number', 'is_verified', 'is_staff',
            'faculty_profile', 'student_profile'
        ]
        read_only_fields = ['id', 'role', 'is_staff', 'is_verified']

    @extend_schema_field(FacultySummarySerializer)
    def get_faculty_profile(self, obj):
        if hasattr(obj, 'faculty_profile'):
            return FacultySummarySerializer(obj.faculty_profile).data
        return None

    @extend_schema_field(StudentSummarySerializer)
    def get_student_profile(self, obj):
        if hasattr(obj, 'student_profile'):
            return StudentSummarySerializer(obj.student_profile).data
        return None


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom JWT serializer that augments the response with the authenticated
    user profile, institutional role, and active permissions.
    """
    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data
