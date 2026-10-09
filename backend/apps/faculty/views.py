from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from drf_spectacular.utils import extend_schema, extend_schema_view

from apps.accounts.models import User
from .models import (
    Faculty, FacultySubjectQualification,
    FacultyAvailability, SectionSubjectAssignment
)
from apps.academics.models import PeriodSlot
from .serializers import (
    FacultySerializer, FacultySubjectQualificationSerializer,
    FacultyAvailabilitySerializer, BatchAvailabilityUpdateSerializer,
    SectionSubjectAssignmentSerializer
)
from .permissions import IsAdminOrFacultyReadOnly, IsAdminOrFacultySelfAvailability


@extend_schema_view(
    list=extend_schema(tags=['Faculty']),
    retrieve=extend_schema(tags=['Faculty']),
    create=extend_schema(tags=['Faculty']),
    update=extend_schema(tags=['Faculty']),
    destroy=extend_schema(tags=['Faculty']),
)
class FacultyViewSet(viewsets.ModelViewSet):
    serializer_class = FacultySerializer
    permission_classes = [IsAdminOrFacultyReadOnly]
    search_fields = ['employee_id', 'user__first_name', 'user__last_name', 'user__email']

    def get_queryset(self):
        qs = Faculty.objects.select_related('user', 'department__college').all().order_by('user__first_name', 'user__last_name')
        dept_id = self.request.query_params.get('department')
        college_id = self.request.query_params.get('college')
        designation = self.request.query_params.get('designation')
        is_active = self.request.query_params.get('is_active')

        if dept_id:
            qs = qs.filter(department_id=dept_id)
        if college_id:
            qs = qs.filter(department__college_id=college_id)
        if designation:
            qs = qs.filter(designation=designation)
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ['true', '1'])
        return qs

    @action(detail=True, methods=['get'], url_path='workload')
    def workload(self, request, pk=None):
        """Return teaching workload summary and remaining capacity."""
        faculty = self.get_object()
        assignments = faculty.teaching_assignments.select_related(
            'subject', 'section__semester__department'
        ).all()

        total_weekly = sum(a.subject.weekly_periods for a in assignments)
        remaining = max(0, faculty.max_weekly_periods - total_weekly)

        return Response({
            'faculty_id': faculty.id,
            'faculty_name': faculty.user.get_full_name() or faculty.user.username,
            'employee_id': faculty.employee_id,
            'department_code': faculty.department.code,
            'max_weekly_periods': faculty.max_weekly_periods,
            'max_daily_periods': faculty.max_daily_periods,
            'current_weekly_load': total_weekly,
            'remaining_weekly_capacity': remaining,
            'assignment_count': assignments.count(),
            'assignments': [
                {
                    'id': a.id,
                    'section_id': a.section_id,
                    'section_name': a.section.name,
                    'subject_code': a.subject.code,
                    'subject_name': a.subject.name,
                    'weekly_periods': a.subject.weekly_periods,
                    'is_primary': a.is_primary,
                }
                for a in assignments
            ]
        })


@extend_schema_view(
    list=extend_schema(tags=['Faculty Qualifications']),
    retrieve=extend_schema(tags=['Faculty Qualifications']),
    create=extend_schema(tags=['Faculty Qualifications']),
    update=extend_schema(tags=['Faculty Qualifications']),
    destroy=extend_schema(tags=['Faculty Qualifications']),
)
class FacultySubjectQualificationViewSet(viewsets.ModelViewSet):
    serializer_class = FacultySubjectQualificationSerializer
    permission_classes = [IsAdminOrFacultyReadOnly]

    def get_queryset(self):
        qs = FacultySubjectQualification.objects.select_related(
            'faculty__user', 'faculty__department', 'subject__department'
        ).all().order_by('subject__code', '-preference_level')

        faculty_id = self.request.query_params.get('faculty')
        subject_id = self.request.query_params.get('subject')
        dept_id = self.request.query_params.get('department')

        if faculty_id:
            qs = qs.filter(faculty_id=faculty_id)
        if subject_id:
            qs = qs.filter(subject_id=subject_id)
        if dept_id:
            qs = qs.filter(subject__department_id=dept_id)
        return qs


@extend_schema_view(
    list=extend_schema(tags=['Faculty Availability']),
    retrieve=extend_schema(tags=['Faculty Availability']),
    create=extend_schema(tags=['Faculty Availability']),
    update=extend_schema(tags=['Faculty Availability']),
    destroy=extend_schema(tags=['Faculty Availability']),
)
class FacultyAvailabilityViewSet(viewsets.ModelViewSet):
    serializer_class = FacultyAvailabilitySerializer
    permission_classes = [IsAdminOrFacultySelfAvailability]

    def get_queryset(self):
        user = self.request.user
        qs = FacultyAvailability.objects.select_related(
            'faculty__user', 'faculty__department', 'period_slot__shift'
        ).all().order_by('period_slot__day_of_week', 'period_slot__period_number')

        if user.role == User.Role.FACULTY:
            # Faculty members can only view their own availability
            try:
                qs = qs.filter(faculty=user.faculty_profile)
            except Faculty.DoesNotExist:
                return qs.none()
        else:
            # Admin can filter by faculty
            faculty_id = self.request.query_params.get('faculty')
            if faculty_id:
                qs = qs.filter(faculty_id=faculty_id)

        shift_id = self.request.query_params.get('shift')
        day_of_week = self.request.query_params.get('day_of_week')
        is_available = self.request.query_params.get('is_available')

        if shift_id:
            qs = qs.filter(period_slot__shift_id=shift_id)
        if day_of_week:
            qs = qs.filter(period_slot__day_of_week=day_of_week.upper())
        if is_available is not None:
            qs = qs.filter(is_available=is_available.lower() in ['true', '1'])

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == User.Role.FACULTY:
            faculty = serializer.validated_data.get('faculty')
            if not faculty or faculty.user != user:
                raise PermissionDenied("You can only set your own availability.")
        serializer.save()

    def perform_update(self, serializer):
        user = self.request.user
        if user.role == User.Role.FACULTY:
            if serializer.instance.faculty.user != user:
                raise PermissionDenied("You can only update your own availability.")
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if user.role == User.Role.FACULTY:
            if instance.faculty.user != user:
                raise PermissionDenied("You can only delete your own availability.")
        instance.delete()

    @extend_schema(
        request=BatchAvailabilityUpdateSerializer,
        responses={200: FacultyAvailabilitySerializer(many=True)},
        tags=['Faculty Availability']
    )
    @action(detail=False, methods=['post'], url_path='batch-update')
    def batch_update(self, request):
        """Batch update availability slots for a faculty member in an atomic transaction."""
        serializer = BatchAvailabilityUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        faculty_id = serializer.validated_data['faculty_id']
        slots_data = serializer.validated_data['slots']

        try:
            faculty = Faculty.objects.select_related('department__college').get(pk=faculty_id)
        except Faculty.DoesNotExist:
            raise ValidationError({'faculty_id': 'Faculty member not found.'})

        # Role authorization check: Faculty can only update their own
        if request.user.role == User.Role.FACULTY:
            try:
                if faculty.id != request.user.faculty_profile.id:
                    raise PermissionDenied("You are only permitted to update your own availability.")
            except Faculty.DoesNotExist:
                raise PermissionDenied("Faculty profile not associated with authenticated user.")

        results = []
        with transaction.atomic():
            for slot_item in slots_data:
                ps_id = slot_item['period_slot_id']
                try:
                    period_slot = PeriodSlot.objects.select_related('shift').get(pk=ps_id)
                except PeriodSlot.DoesNotExist:
                    raise ValidationError({'slots': f"PeriodSlot id {ps_id} does not exist."})

                # Validate cross-college compatibility
                if period_slot.shift.college_id != faculty.department.college_id:
                    raise ValidationError({
                        'slots': f"Period slot {period_slot} does not belong to faculty's college."
                    })

                # Inactive / break period handling
                is_avail = slot_item['is_available']
                if period_slot.is_break and is_avail:
                    raise ValidationError({
                        'slots': f"Cannot mark slot {period_slot} as available because it is a break/recess."
                    })

                avail, _ = FacultyAvailability.objects.update_or_create(
                    faculty=faculty,
                    period_slot=period_slot,
                    defaults={
                        'is_available': is_avail,
                        'is_preferred': slot_item.get('is_preferred', False),
                        'reason': slot_item.get('reason', '')
                    }
                )
                results.append(avail)

        response_serializer = FacultyAvailabilitySerializer(results, many=True)
        return Response(response_serializer.data, status=status.HTTP_200_OK)


@extend_schema_view(
    list=extend_schema(tags=['Section Subject Assignments']),
    retrieve=extend_schema(tags=['Section Subject Assignments']),
    create=extend_schema(tags=['Section Subject Assignments']),
    update=extend_schema(tags=['Section Subject Assignments']),
    destroy=extend_schema(tags=['Section Subject Assignments']),
)
class SectionSubjectAssignmentViewSet(viewsets.ModelViewSet):
    serializer_class = SectionSubjectAssignmentSerializer
    permission_classes = [IsAdminOrFacultyReadOnly]

    def get_queryset(self):
        qs = SectionSubjectAssignment.objects.select_related(
            'section__semester__department__college',
            'subject',
            'faculty__user',
            'faculty__department'
        ).all().order_by('section', 'subject__code')

        section_id = self.request.query_params.get('section')
        subject_id = self.request.query_params.get('subject')
        faculty_id = self.request.query_params.get('faculty')
        dept_id = self.request.query_params.get('department')
        semester_id = self.request.query_params.get('semester')
        academic_year_id = self.request.query_params.get('academic_year')

        if section_id:
            qs = qs.filter(section_id=section_id)
        if subject_id:
            qs = qs.filter(subject_id=subject_id)
        if faculty_id:
            qs = qs.filter(faculty_id=faculty_id)
        if dept_id:
            qs = qs.filter(section__semester__department_id=dept_id)
        if semester_id:
            qs = qs.filter(section__semester_id=semester_id)
        if academic_year_id:
            qs = qs.filter(section__semester__academic_year_id=academic_year_id)

        return qs
