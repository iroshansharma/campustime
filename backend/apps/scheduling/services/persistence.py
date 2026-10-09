import uuid
from typing import List, Dict, Optional
from django.db import transaction
from django.core.exceptions import ValidationError

from apps.academics.models import AcademicYear, Shift, Department, Semester, Section, Subject, PeriodSlot
from apps.faculty.models import Faculty
from apps.rooms.models import Room
from apps.timetables.models import Timetable, TimetableEntry
from apps.audit.models import TimetableAuditLog

from .requirement_loader import SchedulingContext
from .placement_generator import Placement
from .validator import ScheduleValidator, ValidationReport


class TimetablePersistenceService:
    """
    Safely commits validated candidate schedules to the database.
    Guarantees:
    - Candidate schedule validated before touching DB.
    - Atomic transaction: zero partial saves on failure.
    - Locked entries preserved.
    - Published timetables never overwritten (increments version as a new DRAFT).
    - Full audit logging.
    """

    @classmethod
    def persist_schedule(
        cls,
        context: SchedulingContext,
        placements: List[Placement],
        user,
        timetable_name: Optional[str] = None,
        notes: str = ""
    ) -> Timetable:
        # 1. Independent validation check before touching database
        validation_report = ScheduleValidator.validate_schedule(context, placements)
        if not validation_report.is_valid:
            violations_summary = "; ".join(c.message for c in validation_report.conflicts[:5])
            raise ValidationError(
                f"Cannot persist invalid candidate schedule. Hard constraint violations: {violations_summary}"
            )

        with transaction.atomic():
            # 2. Determine target Timetable instance
            target_timetable = None
            if context.scope.timetable_id:
                # Lock existing record against concurrent mutation
                target_timetable = Timetable.objects.select_for_update().get(id=context.scope.timetable_id)

                # Never overwrite a published timetable: create revision version
                if target_timetable.status == Timetable.Status.PUBLISHED:
                    next_version = Timetable.objects.filter(
                        academic_year=target_timetable.academic_year,
                        shift=target_timetable.shift,
                        department=target_timetable.department,
                        semester=target_timetable.semester
                    ).count() + 1

                    target_timetable = Timetable.objects.create(
                        academic_year=target_timetable.academic_year,
                        shift=target_timetable.shift,
                        department=target_timetable.department,
                        semester=target_timetable.semester,
                        name=f"{target_timetable.name} (Rev v{next_version})",
                        status=Timetable.Status.DRAFT,
                        version=next_version,
                        notes=f"Revision derived from published v{target_timetable.version}. {notes}".strip(),
                        created_by=user
                    )
                else:
                    # Existing DRAFT or REVIEW: preserve locked entries, remove unlocked
                    TimetableEntry.objects.filter(
                        timetable=target_timetable,
                        is_locked=False,
                        section_id__in=list(context.sections.keys())
                    ).delete()
            else:
                # Create a new timetable draft
                ay = AcademicYear.objects.get(id=context.scope.academic_year_id)
                shift = None
                if context.scope.shift_id:
                    shift = Shift.objects.get(id=context.scope.shift_id)
                else:
                    first_sec = next(iter(context.sections.values()))
                    shift = Shift.objects.get(id=first_sec.shift_id)

                dept = None
                if context.scope.department_ids and len(context.scope.department_ids) == 1:
                    dept = Department.objects.get(id=context.scope.department_ids[0])

                sem = None
                if context.scope.semester_ids and len(context.scope.semester_ids) == 1:
                    sem = Semester.objects.get(id=context.scope.semester_ids[0])

                existing_count = Timetable.objects.filter(
                    academic_year=ay,
                    shift=shift,
                    department=dept,
                    semester=sem
                ).count()
                version = existing_count + 1

                t_name = timetable_name or f"{ay.name} - {shift.name} Schedule v{version}"
                target_timetable = Timetable.objects.create(
                    academic_year=ay,
                    shift=shift,
                    department=dept,
                    semester=sem,
                    name=t_name,
                    status=Timetable.Status.DRAFT,
                    version=version,
                    notes=notes,
                    created_by=user
                )

            # 3. Create TimetableEntry instances
            entries_to_create = []
            for p in placements:
                sess = p.session
                linked_id = sess.linked_group_id if sess.duration_slots > 1 else None

                for slot_id in p.slot_ids:
                    slot = context.slot_map[slot_id]
                    entry = TimetableEntry(
                        timetable=target_timetable,
                        section_id=sess.section_id,
                        subject_id=sess.subject_id,
                        faculty_id=sess.faculty_id,
                        room_id=p.room_id,
                        period_slot_id=slot.id,
                        day_of_week=slot.day_of_week,
                        is_locked=False,
                        linked_session_id=linked_id
                    )
                    # Trigger model clean to double-check invariants
                    entry.clean()
                    entries_to_create.append(entry)

            TimetableEntry.objects.bulk_create(entries_to_create)

            # 4. Audit Log
            TimetableAuditLog.objects.create(
                timetable=target_timetable,
                user=user,
                action=TimetableAuditLog.Action.GENERATED,
                notes=f"Generated {len(entries_to_create)} timetable entries successfully via automatic scheduling engine.",
                diff_payload={
                    "total_entries": len(entries_to_create),
                    "placements_count": len(placements),
                    "scope_sections": list(context.sections.keys())
                }
            )

        return target_timetable
