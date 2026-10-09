from rest_framework import viewsets, filters
from drf_spectacular.utils import extend_schema, extend_schema_view
from apps.accounts.permissions import IsAdminOrReadOnly

from .models import (
    College, AcademicYear, Shift, WorkingDay,
    PeriodSlot, Department, Semester, Section, Subject
)
from .serializers import (
    CollegeSerializer, AcademicYearSerializer, ShiftSerializer,
    WorkingDaySerializer, PeriodSlotSerializer, DepartmentSerializer,
    SemesterSerializer, SectionSerializer, SubjectSerializer
)


@extend_schema_view(
    list=extend_schema(tags=['Colleges']),
    retrieve=extend_schema(tags=['Colleges']),
    create=extend_schema(tags=['Colleges']),
    update=extend_schema(tags=['Colleges']),
    destroy=extend_schema(tags=['Colleges']),
)
class CollegeViewSet(viewsets.ModelViewSet):
    queryset = College.objects.all().order_by('name')
    serializer_class = CollegeSerializer
    permission_classes = [IsAdminOrReadOnly]
    search_fields = ['name', 'code']


@extend_schema_view(
    list=extend_schema(tags=['Academic Years']),
    retrieve=extend_schema(tags=['Academic Years']),
    create=extend_schema(tags=['Academic Years']),
    update=extend_schema(tags=['Academic Years']),
    destroy=extend_schema(tags=['Academic Years']),
)
class AcademicYearViewSet(viewsets.ModelViewSet):
    serializer_class = AcademicYearSerializer
    permission_classes = [IsAdminOrReadOnly]
    search_fields = ['name']

    def get_queryset(self):
        qs = AcademicYear.objects.select_related('college').all().order_by('-start_date')
        college_id = self.request.query_params.get('college')
        is_current = self.request.query_params.get('is_current')

        if college_id:
            qs = qs.filter(college_id=college_id)
        if is_current is not None:
            qs = qs.filter(is_current=is_current.lower() in ['true', '1'])
        return qs


@extend_schema_view(
    list=extend_schema(tags=['Shifts']),
    retrieve=extend_schema(tags=['Shifts']),
    create=extend_schema(tags=['Shifts']),
    update=extend_schema(tags=['Shifts']),
    destroy=extend_schema(tags=['Shifts']),
)
class ShiftViewSet(viewsets.ModelViewSet):
    serializer_class = ShiftSerializer
    permission_classes = [IsAdminOrReadOnly]
    search_fields = ['name', 'code']

    def get_queryset(self):
        qs = Shift.objects.select_related('college').all().order_by('start_time')
        college_id = self.request.query_params.get('college')
        is_active = self.request.query_params.get('is_active')

        if college_id:
            qs = qs.filter(college_id=college_id)
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ['true', '1'])
        return qs


@extend_schema_view(
    list=extend_schema(tags=['Working Days']),
    retrieve=extend_schema(tags=['Working Days']),
    create=extend_schema(tags=['Working Days']),
    update=extend_schema(tags=['Working Days']),
    destroy=extend_schema(tags=['Working Days']),
)
class WorkingDayViewSet(viewsets.ModelViewSet):
    serializer_class = WorkingDaySerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = WorkingDay.objects.select_related('college').all().order_by('order')
        college_id = self.request.query_params.get('college')
        is_active = self.request.query_params.get('is_active')

        if college_id:
            qs = qs.filter(college_id=college_id)
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ['true', '1'])
        return qs


@extend_schema_view(
    list=extend_schema(tags=['Period Slots']),
    retrieve=extend_schema(tags=['Period Slots']),
    create=extend_schema(tags=['Period Slots']),
    update=extend_schema(tags=['Period Slots']),
    destroy=extend_schema(tags=['Period Slots']),
)
class PeriodSlotViewSet(viewsets.ModelViewSet):
    serializer_class = PeriodSlotSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = PeriodSlot.objects.select_related('shift').all().order_by('shift', 'day_of_week', 'period_number')
        shift_id = self.request.query_params.get('shift')
        day_of_week = self.request.query_params.get('day_of_week')
        is_break = self.request.query_params.get('is_break')

        if shift_id:
            qs = qs.filter(shift_id=shift_id)
        if day_of_week:
            qs = qs.filter(day_of_week=day_of_week.upper())
        if is_break is not None:
            qs = qs.filter(is_break=is_break.lower() in ['true', '1'])
        return qs


@extend_schema_view(
    list=extend_schema(tags=['Departments']),
    retrieve=extend_schema(tags=['Departments']),
    create=extend_schema(tags=['Departments']),
    update=extend_schema(tags=['Departments']),
    destroy=extend_schema(tags=['Departments']),
)
class DepartmentViewSet(viewsets.ModelViewSet):
    serializer_class = DepartmentSerializer
    permission_classes = [IsAdminOrReadOnly]
    search_fields = ['name', 'code']

    def get_queryset(self):
        qs = Department.objects.select_related('college').all().order_by('name')
        college_id = self.request.query_params.get('college')
        is_active = self.request.query_params.get('is_active')

        if college_id:
            qs = qs.filter(college_id=college_id)
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ['true', '1'])
        return qs


@extend_schema_view(
    list=extend_schema(tags=['Semesters']),
    retrieve=extend_schema(tags=['Semesters']),
    create=extend_schema(tags=['Semesters']),
    update=extend_schema(tags=['Semesters']),
    destroy=extend_schema(tags=['Semesters']),
)
class SemesterViewSet(viewsets.ModelViewSet):
    serializer_class = SemesterSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = Semester.objects.select_related('academic_year', 'department', 'shift').all().order_by('department', 'semester_number')
        ay_id = self.request.query_params.get('academic_year')
        dept_id = self.request.query_params.get('department')
        shift_id = self.request.query_params.get('shift')
        sem_num = self.request.query_params.get('semester_number')

        if ay_id:
            qs = qs.filter(academic_year_id=ay_id)
        if dept_id:
            qs = qs.filter(department_id=dept_id)
        if shift_id:
            qs = qs.filter(shift_id=shift_id)
        if sem_num:
            qs = qs.filter(semester_number=sem_num)
        return qs


@extend_schema_view(
    list=extend_schema(tags=['Sections']),
    retrieve=extend_schema(tags=['Sections']),
    create=extend_schema(tags=['Sections']),
    update=extend_schema(tags=['Sections']),
    destroy=extend_schema(tags=['Sections']),
)
class SectionViewSet(viewsets.ModelViewSet):
    serializer_class = SectionSerializer
    permission_classes = [IsAdminOrReadOnly]
    search_fields = ['name', 'semester__department__code']

    def get_queryset(self):
        qs = Section.objects.select_related('semester__department', 'semester__shift').all().order_by('semester', 'name')
        semester_id = self.request.query_params.get('semester')
        dept_id = self.request.query_params.get('department')

        if semester_id:
            qs = qs.filter(semester_id=semester_id)
        if dept_id:
            qs = qs.filter(semester__department_id=dept_id)
        return qs


@extend_schema_view(
    list=extend_schema(tags=['Subjects']),
    retrieve=extend_schema(tags=['Subjects']),
    create=extend_schema(tags=['Subjects']),
    update=extend_schema(tags=['Subjects']),
    destroy=extend_schema(tags=['Subjects']),
)
class SubjectViewSet(viewsets.ModelViewSet):
    serializer_class = SubjectSerializer
    permission_classes = [IsAdminOrReadOnly]
    search_fields = ['code', 'name']

    def get_queryset(self):
        qs = Subject.objects.select_related('department').all().order_by('code')
        dept_id = self.request.query_params.get('department')
        subject_type = self.request.query_params.get('subject_type')

        if dept_id:
            qs = qs.filter(department_id=dept_id)
        if subject_type:
            qs = qs.filter(subject_type=subject_type.upper())
        return qs
