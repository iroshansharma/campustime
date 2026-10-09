from django.utils import timezone
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema, OpenApiParameter

from apps.accounts.models import User
from apps.accounts.permissions import IsAdminUserRole, IsAdminOrReadOnly
from apps.audit.models import TimetableAuditLog

from .models import Timetable, TimetableEntry
from .serializers import (
    TimetableSerializer,
    TimetableDetailSerializer,
    TimetableEntrySerializer,
    GenerateScheduleRequestSerializer,
    GenerationResultSerializer,
    ValidationReportSerializer,
)
from apps.scheduling.services import (
    TimetableGenerationEngine,
    SchedulingScope,
    SolverConfig,
    ScheduleValidator
)


class TimetableViewSet(viewsets.ModelViewSet):
    """
    Manages institutional timetable records, automatic schedule generation,
    independent constraint validation, and state progression to PUBLISHED.
    """
    queryset = Timetable.objects.select_related(
        'academic_year', 'shift', 'department', 'semester', 'created_by'
    ).prefetch_related('entries')
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ['academic_year', 'shift', 'department', 'semester', 'status']
    search_fields = ['name', 'department__name', 'academic_year__name']
    ordering_fields = ['created_at', 'version', 'name']
    ordering = ['-academic_year__start_date', '-version']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return TimetableDetailSerializer
        return TimetableSerializer

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Timetable.objects.none()
        if user.role == User.Role.ADMIN or user.is_staff or user.is_superuser:
            return self.queryset.all()
        return self.queryset.filter(status=Timetable.Status.PUBLISHED)

    @extend_schema(
        request=GenerateScheduleRequestSerializer,
        responses={200: GenerationResultSerializer, 400: GenerationResultSerializer}
    )
    @action(
        detail=False,
        methods=['post'],
        url_path='generate',
        permission_classes=[IsAdminUserRole]
    )
    def generate(self, request):
        """
        Request automated timetable generation using the CSP backtracking engine.
        Only admins can generate institutional timetables.
        """
        serializer = GenerateScheduleRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        scope = SchedulingScope(
            academic_year_id=data['academic_year_id'],
            shift_id=data.get('shift_id'),
            department_ids=data.get('department_ids') or None,
            semester_ids=data.get('semester_ids') or None,
            section_ids=data.get('section_ids') or None,
            timetable_id=data.get('timetable_id')
        )

        config = SolverConfig(
            max_backtracks=data.get('max_backtracks', 5000),
            timeout_seconds=data.get('timeout_seconds', 30.0)
        )

        result = TimetableGenerationEngine.generate(
            scope=scope,
            config=config,
            user=request.user,
            timetable_name=data.get('name'),
            notes=data.get('notes', ''),
            persist=data.get('persist', True)
        )

        result_dict = result.to_dict()
        http_status = status.HTTP_200_OK if result.success else status.HTTP_400_BAD_REQUEST
        return Response(result_dict, status=http_status)

    @extend_schema(responses={200: ValidationReportSerializer})
    @action(
        detail=True,
        methods=['get'],
        url_path='conflicts',
        permission_classes=[IsAdminUserRole]
    )
    def conflicts(self, request, pk=None):
        """
        Run independent validation on the timetable and return structured diagnostics.
        """
        timetable = self.get_object()
        report = ScheduleValidator.validate_timetable_instance(timetable.id)
        return Response(report.to_dict(), status=status.HTTP_200_OK)

    @extend_schema(responses={200: ValidationReportSerializer})
    @action(
        detail=True,
        methods=['post'],
        url_path='validate',
        permission_classes=[IsAdminUserRole]
    )
    def validate_draft(self, request, pk=None):
        """
        Revalidate a draft timetable.
        """
        timetable = self.get_object()
        report = ScheduleValidator.validate_timetable_instance(timetable.id)

        TimetableAuditLog.objects.create(
            timetable=timetable,
            user=request.user,
            action=TimetableAuditLog.Action.VALIDATED,
            notes=f"Timetable re-validated. Result: {'Valid' if report.is_valid else 'Violations found'}.",
            diff_payload={'hard_violations': report.hard_constraint_violations}
        )

        return Response(report.to_dict(), status=status.HTTP_200_OK)

    @extend_schema(responses={200: TimetableEntrySerializer(many=True)})
    @action(
        detail=True,
        methods=['get'],
        url_path='entries',
        permission_classes=[IsAuthenticated]
    )
    def entries(self, request, pk=None):
        """
        Retrieve scheduled sessions for the timetable with optional section, faculty, day, or room filtering.
        """
        timetable = self.get_object()
        qs = timetable.entries.select_related(
            'section', 'subject', 'faculty__user', 'room', 'period_slot'
        ).all()

        section_id = request.query_params.get('section')
        if section_id:
            qs = qs.filter(section_id=section_id)

        faculty_id = request.query_params.get('faculty')
        if faculty_id:
            qs = qs.filter(faculty_id=faculty_id)

        room_id = request.query_params.get('room')
        if room_id:
            qs = qs.filter(room_id=room_id)

        day = request.query_params.get('day_of_week')
        if day:
            qs = qs.filter(day_of_week=day)

        serializer = TimetableEntrySerializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(responses={200: TimetableSerializer})
    @action(
        detail=True,
        methods=['post'],
        url_path='publish',
        permission_classes=[IsAdminUserRole]
    )
    def publish(self, request, pk=None):
        """
        Publish a draft timetable after independent validation check.
        Cannot publish a timetable that has hard constraint violations.
        """
        timetable = self.get_object()

        if timetable.status == Timetable.Status.PUBLISHED:
            return Response(
                {'detail': 'This timetable is already published.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Independent validation gate
        report = ScheduleValidator.validate_timetable_instance(timetable.id)
        if not report.is_valid:
            return Response(
                {
                    'detail': 'Cannot publish timetable with hard constraint violations.',
                    'validation_report': report.to_dict()
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            timetable.status = Timetable.Status.PUBLISHED
            timetable.published_at = timezone.now()
            timetable.save()

            TimetableAuditLog.objects.create(
                timetable=timetable,
                user=request.user,
                action=TimetableAuditLog.Action.PUBLISHED,
                notes=f"Timetable '{timetable.name}' v{timetable.version} published successfully.",
                diff_payload={'entries_count': timetable.entries.count()}
            )

        return Response(TimetableSerializer(timetable).data, status=status.HTTP_200_OK)

    @action(
        detail=False,
        methods=['get'],
        url_path='generation-jobs/(?P<job_id>[^/.]+)',
        permission_classes=[IsAdminUserRole]
    )
    def job_status(self, request, job_id=None):
        """
        Endpoint to retrieve async job status if background execution is queried.
        """
        return Response({
            'job_id': job_id,
            'status': 'COMPLETED',
            'message': 'Job execution completed synchronously.'
        }, status=status.HTTP_200_OK)


class TimetableEntryViewSet(viewsets.ModelViewSet):
    """
    CRUD and slot locking operations on individual TimetableEntry rows.
    """
    queryset = TimetableEntry.objects.select_related(
        'timetable', 'section', 'subject', 'faculty__user', 'room', 'period_slot'
    ).all()
    serializer_class = TimetableEntrySerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ['timetable', 'section', 'faculty', 'room', 'day_of_week', 'is_locked']

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUserRole])
    def lock(self, request, pk=None):
        """Lock/pin entry to prevent modification during timetable regeneration."""
        entry = self.get_object()
        entry.is_locked = True
        entry.save()
        TimetableAuditLog.objects.create(
            timetable=entry.timetable,
            user=request.user,
            action=TimetableAuditLog.Action.SLOT_LOCKED,
            notes=f"Locked entry for section {entry.section.name} at {entry.day_of_week} period {entry.period_slot.period_number}."
        )
        return Response(TimetableEntrySerializer(entry).data)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUserRole])
    def unlock(self, request, pk=None):
        """Unlock entry allowing regeneration."""
        entry = self.get_object()
        entry.is_locked = False
        entry.save()
        TimetableAuditLog.objects.create(
            timetable=entry.timetable,
            user=request.user,
            action=TimetableAuditLog.Action.SLOT_LOCKED,
            notes=f"Unlocked entry for section {entry.section.name} at {entry.day_of_week} period {entry.period_slot.period_number}."
        )
        return Response(TimetableEntrySerializer(entry).data)
