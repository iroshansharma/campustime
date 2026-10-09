from django.utils import timezone
from django.db import transaction
from django.http import HttpResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError, PermissionDenied
from drf_spectacular.utils import extend_schema, OpenApiParameter

from apps.accounts.models import User
from apps.accounts.permissions import IsAdminUserRole, IsAdminOrReadOnly
from apps.academics.models import PeriodSlot, Section, Subject
from apps.faculty.models import Faculty, FacultyAvailability
from apps.rooms.models import Room
from apps.audit.models import TimetableAuditLog

from .models import Timetable, TimetableEntry
from .serializers import (
    TimetableSerializer,
    TimetableDetailSerializer,
    TimetableEntrySerializer,
    GenerateScheduleRequestSerializer,
    GenerationResultSerializer,
    ValidationReportSerializer,
    MoveEntryRequestSerializer,
    FacultyWorkloadReportSerializer,
    RoomUtilizationReportSerializer,
    TimetableSummaryReportSerializer,
)
from apps.scheduling.services import (
    TimetableGenerationEngine,
    SchedulingScope,
    SolverConfig,
    ScheduleValidator
)
from .services.pdf_generator import TimetablePDFGenerator


class TimetableViewSet(viewsets.ModelViewSet):
    """
    Manages institutional timetable records, automatic schedule generation,
    independent constraint validation, revision forking, reporting, and PDF export.
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

        solver_kwargs = {}
        if data.get('max_backtracks') is not None:
            solver_kwargs['max_backtracks'] = data['max_backtracks']
        if data.get('timeout_seconds') is not None:
            solver_kwargs['timeout_seconds'] = data['timeout_seconds']
        config = SolverConfig(**solver_kwargs)

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
        timetable = self.get_object()

        if timetable.status == Timetable.Status.PUBLISHED:
            return Response(
                {'detail': 'This timetable is already published.'},
                status=status.HTTP_400_BAD_REQUEST
            )

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

    @extend_schema(responses={200: TimetableSerializer})
    @action(
        detail=True,
        methods=['post'],
        url_path='create-revision',
        permission_classes=[IsAdminUserRole]
    )
    def create_revision(self, request, pk=None):
        """
        Forks a published or reviewed timetable into an editable DRAFT revision,
        duplicating all entries and incrementing the version number.
        """
        parent_tt = self.get_object()

        with transaction.atomic():
            next_version = Timetable.objects.filter(
                academic_year=parent_tt.academic_year,
                shift=parent_tt.shift,
                department=parent_tt.department,
                semester=parent_tt.semester
            ).count() + 1

            new_tt = Timetable.objects.create(
                academic_year=parent_tt.academic_year,
                shift=parent_tt.shift,
                department=parent_tt.department,
                semester=parent_tt.semester,
                name=f"{parent_tt.name} (Rev v{next_version})",
                status=Timetable.Status.DRAFT,
                version=next_version,
                notes=f"Revision created from v{parent_tt.version} ({parent_tt.status}).",
                created_by=request.user
            )

            # Clone entries
            old_entries = list(parent_tt.entries.all())
            cloned_entries = [
                TimetableEntry(
                    timetable=new_tt,
                    section_id=e.section_id,
                    subject_id=e.subject_id,
                    faculty_id=e.faculty_id,
                    room_id=e.room_id,
                    period_slot_id=e.period_slot_id,
                    day_of_week=e.day_of_week,
                    is_locked=e.is_locked,
                    linked_session_id=e.linked_session_id
                )
                for e in old_entries
            ]
            TimetableEntry.objects.bulk_create(cloned_entries)

            TimetableAuditLog.objects.create(
                timetable=new_tt,
                user=request.user,
                action=TimetableAuditLog.Action.GENERATED,
                notes=f"Forked new DRAFT revision v{next_version} with {len(cloned_entries)} entries.",
                diff_payload={'parent_timetable_id': parent_tt.id, 'parent_version': parent_tt.version}
            )

        return Response(TimetableSerializer(new_tt).data, status=status.HTTP_201_CREATED)

    @action(
        detail=False,
        methods=['get'],
        url_path='my-schedule',
        permission_classes=[IsAuthenticated]
    )
    def my_schedule(self, request):
        """
        Retrieves user-scoped published timetable entries for Students and Faculty.
        Enforces strict role permissions: students only access their section,
        faculty only access their teaching schedule, and unapproved drafts are hidden.
        """
        user = request.user

        if user.role == User.Role.STUDENT:
            profile = getattr(user, 'student_profile', None)
            if not profile or not profile.section_id:
                return Response({
                    'has_schedule': False,
                    'message': 'No student profile or section enrolled.'
                })

            # Query latest published timetable covering the student's section
            latest_tt = Timetable.objects.filter(
                status=Timetable.Status.PUBLISHED,
                entries__section_id=profile.section_id
            ).distinct().order_by('-version', '-published_at').first()

            if not latest_tt:
                return Response({
                    'has_schedule': False,
                    'message': 'No published timetable is currently available for your section.'
                })

            entries = latest_tt.entries.filter(section_id=profile.section_id).select_related(
                'subject', 'faculty__user', 'room', 'period_slot'
            )

            return Response({
                'has_schedule': True,
                'role': 'STUDENT',
                'timetable': TimetableSerializer(latest_tt).data,
                'section_name': profile.section.name if profile.section else '',
                'entries': TimetableEntrySerializer(entries, many=True).data
            })

        elif user.role == User.Role.FACULTY:
            faculty = getattr(user, 'faculty_profile', None)
            if not faculty:
                return Response({
                    'has_schedule': False,
                    'message': 'No faculty profile found.'
                })

            # Retrieve entries across all published timetables for this faculty
            entries = TimetableEntry.objects.filter(
                timetable__status=Timetable.Status.PUBLISHED,
                faculty=faculty
            ).select_related('timetable', 'section', 'subject', 'room', 'period_slot')

            return Response({
                'has_schedule': True,
                'role': 'FACULTY',
                'faculty_name': f"{user.first_name} {user.last_name}".strip() or user.username,
                'employee_id': faculty.employee_id,
                'entries': TimetableEntrySerializer(entries, many=True).data
            })

        else:  # ADMIN
            section_id = request.query_params.get('section')
            faculty_id = request.query_params.get('faculty')
            qs = TimetableEntry.objects.filter(timetable__status=Timetable.Status.PUBLISHED)
            if section_id:
                qs = qs.filter(section_id=section_id)
            if faculty_id:
                qs = qs.filter(faculty_id=faculty_id)

            return Response({
                'has_schedule': True,
                'role': 'ADMIN',
                'entries': TimetableEntrySerializer(qs[:100], many=True).data
            })

    @action(
        detail=True,
        methods=['get'],
        url_path='export-pdf',
        permission_classes=[IsAuthenticated]
    )
    def export_pdf(self, request, pk=None):
        """
        Exports a printable landscape PDF for a Section, Faculty member, or Room.
        Enforces strict authorization: Students/Faculty cannot view unapproved drafts.
        """
        timetable = self.get_object()
        user = request.user

        # Non-admins can only export PUBLISHED timetables
        if user.role != User.Role.ADMIN and not user.is_staff and not user.is_superuser:
            if timetable.status != Timetable.Status.PUBLISHED:
                raise PermissionDenied("Only published timetables can be exported.")

        export_type = request.query_params.get('type', 'section')

        if export_type == 'section':
            section_id = request.query_params.get('section_id')
            if not section_id:
                first_entry = timetable.entries.first()
                if first_entry:
                    section_id = first_entry.section_id
                else:
                    return Response({'detail': 'No entries in timetable to export.'}, status=400)

            # Security check for student
            if user.role == User.Role.STUDENT:
                profile = getattr(user, 'student_profile', None)
                if not profile or profile.section_id != int(section_id):
                    raise PermissionDenied("Students may only export their own section's schedule.")

            pdf_bytes = TimetablePDFGenerator.generate_section_pdf(timetable, int(section_id))
            filename = f"Timetable_Section_{section_id}.pdf"

        elif export_type == 'faculty':
            faculty_id = request.query_params.get('faculty_id')
            if not faculty_id:
                first_entry = timetable.entries.first()
                if first_entry:
                    faculty_id = first_entry.faculty_id
                else:
                    return Response({'detail': 'No entries in timetable to export.'}, status=400)

            if user.role == User.Role.FACULTY:
                fac = getattr(user, 'faculty_profile', None)
                if not fac or fac.id != int(faculty_id):
                    raise PermissionDenied("Faculty may only export their own teaching schedule.")

            pdf_bytes = TimetablePDFGenerator.generate_faculty_pdf(timetable, int(faculty_id))
            filename = f"Timetable_Faculty_{faculty_id}.pdf"

        elif export_type == 'room':
            room_id = request.query_params.get('room_id')
            if not room_id:
                first_entry = timetable.entries.first()
                if first_entry:
                    room_id = first_entry.room_id
                else:
                    return Response({'detail': 'No entries in timetable to export.'}, status=400)

            if user.role not in [User.Role.ADMIN] and not user.is_staff:
                raise PermissionDenied("Only administrators can export room utilization schedules.")

            pdf_bytes = TimetablePDFGenerator.generate_room_pdf(timetable, int(room_id))
            filename = f"Timetable_Room_{room_id}.pdf"

        else:
            return Response({'detail': "Invalid export type. Must be 'section', 'faculty', or 'room'."}, status=400)

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response

    @action(
        detail=True,
        methods=['get'],
        url_path='reports/workload',
        permission_classes=[IsAdminOrReadOnly]
    )
    def report_workload(self, request, pk=None):
        timetable = self.get_object()
        entries = list(timetable.entries.select_related('faculty__user', 'faculty__department').all())

        fac_counts = {}
        for e in entries:
            fac_counts[e.faculty] = fac_counts.get(e.faculty, 0) + 1

        results = []
        for fac, count in fac_counts.items():
            u = fac.user
            name = f"{u.first_name} {u.last_name}".strip() or u.username
            util = round((count / fac.max_weekly_periods * 100), 1) if fac.max_weekly_periods else 0.0
            results.append({
                'faculty_id': fac.id,
                'faculty_name': name,
                'employee_id': fac.employee_id,
                'department_code': fac.department.code,
                'max_weekly_periods': fac.max_weekly_periods,
                'max_daily_periods': fac.max_daily_periods,
                'assigned_periods': count,
                'utilization_pct': util
            })

        results.sort(key=lambda x: x['assigned_periods'], reverse=True)
        return Response(results)

    @action(
        detail=True,
        methods=['get'],
        url_path='reports/room-utilization',
        permission_classes=[IsAdminOrReadOnly]
    )
    def report_room_utilization(self, request, pk=None):
        timetable = self.get_object()
        entries = list(timetable.entries.select_related('room').all())

        # Available non-break slots in shift
        total_shift_slots = PeriodSlot.objects.filter(shift=timetable.shift, is_break=False).count() or 1

        room_counts = {}
        for e in entries:
            room_counts[e.room] = room_counts.get(e.room, 0) + 1

        results = []
        for room, count in room_counts.items():
            util = round((count / total_shift_slots * 100), 1)
            results.append({
                'room_id': room.id,
                'room_code': room.code,
                'room_name': room.name,
                'room_type': room.get_room_type_display(),
                'capacity': room.capacity,
                'total_slots_available': total_shift_slots,
                'booked_slots': count,
                'utilization_pct': util
            })

        results.sort(key=lambda x: x['booked_slots'], reverse=True)
        return Response(results)

    @action(
        detail=True,
        methods=['get'],
        url_path='reports/summary',
        permission_classes=[IsAdminOrReadOnly]
    )
    def report_summary(self, request, pk=None):
        timetable = self.get_object()
        entries = timetable.entries.select_related('subject')

        theory_count = entries.filter(subject__subject_type='THEORY').count()
        lab_count = entries.filter(subject__subject_type='LAB').count()
        sec_count = entries.values('section').distinct().count()
        fac_count = entries.values('faculty').distinct().count()
        room_count = entries.values('room').distinct().count()

        val_report = ScheduleValidator.validate_timetable_instance(timetable.id)

        data = {
            'timetable_id': timetable.id,
            'name': timetable.name,
            'status': timetable.status,
            'version': timetable.version,
            'academic_year': timetable.academic_year.name,
            'shift': timetable.shift.name,
            'total_entries': entries.count(),
            'theory_entries': theory_count,
            'lab_entries': lab_count,
            'sections_count': sec_count,
            'faculty_count': fac_count,
            'rooms_count': room_count,
            'is_valid': val_report.is_valid,
            'hard_violations': val_report.hard_constraint_violations
        }
        return Response(data)


class TimetableEntryViewSet(viewsets.ModelViewSet):
    """
    CRUD, manual movement with rigorous collision checks, and slot locking
    operations on individual TimetableEntry rows.
    """
    queryset = TimetableEntry.objects.select_related(
        'timetable', 'section', 'subject', 'faculty__user', 'room', 'period_slot'
    ).all()
    serializer_class = TimetableEntrySerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ['timetable', 'section', 'faculty', 'room', 'day_of_week', 'is_locked']

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUserRole])
    def move(self, request, pk=None):
        """
        Manually reassigns an entry to a new slot, room, or faculty.
        Performs atomic server-side collision and workload validation,
        rejecting invalid changes and keeping original state intact.
        Linked multi-period lab blocks are protected against fragmentation.
        """
        entry = self.get_object()

        # 1. Protection for published timetables
        if entry.timetable.status == Timetable.Status.PUBLISHED:
            raise ValidationError({
                'detail': 'Published timetables cannot be modified directly. Create a revision draft first.'
            })

        # 2. Protection for locked entries
        if entry.is_locked:
            raise ValidationError({
                'detail': 'This entry is locked. Please unlock it before making changes.'
            })

        serializer = MoveEntryRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        target_slot_id = data['period_slot_id']
        target_room_id = data.get('room_id') or entry.room_id
        target_faculty_id = data.get('faculty_id') or entry.faculty_id

        try:
            target_slot = PeriodSlot.objects.get(id=target_slot_id)
            target_room = Room.objects.get(id=target_room_id)
            target_faculty = Faculty.objects.select_related('user').get(id=target_faculty_id)
        except (PeriodSlot.DoesNotExist, Room.DoesNotExist, Faculty.DoesNotExist) as e:
            raise ValidationError({'detail': f'Referenced entity not found: {str(e)}'})

        # 3. Check break slots
        if target_slot.is_break:
            raise ValidationError({
                'conflict_code': 'BREAK_SLOT_VIOLATION',
                'message': f"Cannot schedule during break slot '{target_slot.break_label}'.",
                'suggested_action': 'Select an active instruction period slot.'
            })

        # 4. Check shift boundaries
        if target_slot.shift_id != entry.section.semester.shift_id:
            raise ValidationError({
                'conflict_code': 'SHIFT_BOUNDARY_VIOLATION',
                'message': f"Slot shift ({target_slot.shift_id}) does not match section shift ({entry.section.semester.shift_id})."
            })

        # 5. Check room capacity
        if target_room.capacity < entry.section.student_count:
            raise ValidationError({
                'conflict_code': 'ROOM_CAPACITY_DEFICIT',
                'message': f"Room '{target_room.code}' capacity ({target_room.capacity}) is insufficient for Section headcount ({entry.section.student_count}).",
                'suggested_action': 'Choose a larger classroom.'
            })

        # 6. Check lab room type
        if entry.subject.subject_type == 'LAB' and target_room.room_type != 'LAB':
            raise ValidationError({
                'conflict_code': 'ROOM_TYPE_MISMATCH',
                'message': f"Laboratory subject '{entry.subject.code}' must be scheduled in a LAB room."
            })

        # 7. Check collisions (excluding current entry)
        other_entries = TimetableEntry.objects.filter(timetable=entry.timetable).exclude(id=entry.id)

        # Section collision
        if other_entries.filter(section=entry.section, period_slot=target_slot).exists():
            raise ValidationError({
                'conflict_code': 'SECTION_DOUBLE_BOOKING',
                'message': f"Section '{entry.section.name}' already has a class scheduled at {target_slot.day_of_week} Period {target_slot.period_number}.",
                'suggested_action': 'Select an empty period slot for this section.'
            })

        # Faculty collision
        if other_entries.filter(faculty=target_faculty, period_slot=target_slot).exists():
            raise ValidationError({
                'conflict_code': 'FACULTY_DOUBLE_BOOKING',
                'message': f"Faculty '{target_faculty.user.last_name or target_faculty.user.username}' is already teaching at {target_slot.day_of_week} Period {target_slot.period_number}.",
                'suggested_action': 'Choose another time slot or assign substitute faculty.'
            })

        # Room collision
        if other_entries.filter(room=target_room, period_slot=target_slot).exists():
            raise ValidationError({
                'conflict_code': 'ROOM_DOUBLE_BOOKING',
                'message': f"Room '{target_room.code}' is already occupied at {target_slot.day_of_week} Period {target_slot.period_number}.",
                'suggested_action': 'Select an unoccupied room.'
            })

        # 8. Faculty availability check
        if FacultyAvailability.objects.filter(
            faculty=target_faculty,
            period_slot=target_slot,
            is_available=False
        ).exists():
            raise ValidationError({
                'conflict_code': 'FACULTY_UNAVAILABLE',
                'message': f"Faculty '{target_faculty.user.last_name or target_faculty.user.username}' is marked unavailable at this time."
            })

        # 9. Faculty daily workload limit
        cur_day_entries = other_entries.filter(
            faculty=target_faculty,
            period_slot__day_of_week=target_slot.day_of_week
        ).count()
        if cur_day_entries + 1 > target_faculty.max_daily_periods:
            raise ValidationError({
                'conflict_code': 'FACULTY_DAILY_LOAD_EXCEEDED',
                'message': f"Moving class would assign {cur_day_entries + 1} periods to faculty on {target_slot.day_of_week}, exceeding daily limit of {target_faculty.max_daily_periods}."
            })

        # 10. Multi-period lab contiguity protection
        if entry.linked_session_id and entry.subject.subject_type == 'LAB':
            siblings = list(other_entries.filter(linked_session_id=entry.linked_session_id))
            if siblings:
                # If sibling exists, verify target slot is consecutive with sibling
                sib_slots = [s.period_slot for s in siblings]
                # Check if target_slot is on the same day and adjacent
                is_adjacent = any(
                    s.day_of_week == target_slot.day_of_week and abs(s.period_number - target_slot.period_number) == 1
                    for s in sib_slots
                )
                if not is_adjacent:
                    raise ValidationError({
                        'conflict_code': 'LAB_CONTIGUITY_VIOLATION',
                        'message': 'Cannot fragment consecutive multi-period lab block. Target slot must be consecutive with linked lab periods on the same day.'
                    })

        # Atomic commit
        with transaction.atomic():
            old_slot = entry.period_slot
            entry.period_slot = target_slot
            entry.day_of_week = target_slot.day_of_week
            entry.room = target_room
            entry.faculty = target_faculty
            entry.save()

            TimetableAuditLog.objects.create(
                timetable=entry.timetable,
                user=request.user,
                action=TimetableAuditLog.Action.MANUAL_OVERRIDE,
                notes=(
                    f"Moved {entry.subject.code} from {old_slot.day_of_week} P{old_slot.period_number} "
                    f"to {target_slot.day_of_week} P{target_slot.period_number} in {target_room.code}."
                ),
                diff_payload={
                    'entry_id': entry.id,
                    'old_slot_id': old_slot.id,
                    'new_slot_id': target_slot.id,
                    'room_id': target_room.id,
                    'faculty_id': target_faculty.id
                }
            )

        return Response(TimetableEntrySerializer(entry).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUserRole])
    def lock(self, request, pk=None):
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
