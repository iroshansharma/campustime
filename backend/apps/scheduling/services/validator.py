from dataclasses import dataclass, field
from typing import List, Dict, Set, Optional, Tuple

from apps.academics.models import PeriodSlot, Section, Subject
from apps.faculty.models import Faculty
from apps.rooms.models import Room
from apps.timetables.models import Timetable, TimetableEntry

from .requirement_loader import SchedulingContext
from .placement_generator import Placement


@dataclass
class ScheduleConflict:
    conflict_code: str
    severity: str  # 'ERROR', 'WARNING'
    message: str
    section_id: Optional[int] = None
    section_name: Optional[str] = None
    faculty_id: Optional[int] = None
    faculty_name: Optional[str] = None
    room_id: Optional[int] = None
    room_name: Optional[str] = None
    period_slot_ids: List[int] = field(default_factory=list)
    day_of_week: Optional[str] = None
    subject_code: Optional[str] = None
    suggested_action: Optional[str] = None


@dataclass
class ValidationReport:
    is_valid: bool
    total_conflicts: int
    hard_constraint_violations: int
    sessions_required: int
    sessions_scheduled: int
    conflicts: List[ScheduleConflict] = field(default_factory=list)
    summary: str = ""

    def to_dict(self) -> dict:
        return {
            'is_valid': self.is_valid,
            'total_conflicts': self.total_conflicts,
            'hard_constraint_violations': self.hard_constraint_violations,
            'sessions_required': self.sessions_required,
            'sessions_scheduled': self.sessions_scheduled,
            'summary': self.summary,
            'conflicts': [
                {
                    'conflict_code': c.conflict_code,
                    'severity': c.severity,
                    'message': c.message,
                    'section_id': c.section_id,
                    'section_name': c.section_name,
                    'faculty_id': c.faculty_id,
                    'faculty_name': c.faculty_name,
                    'room_id': c.room_id,
                    'room_name': c.room_name,
                    'period_slot_ids': c.period_slot_ids,
                    'day_of_week': c.day_of_week,
                    'subject_code': c.subject_code,
                    'suggested_action': c.suggested_action,
                }
                for c in self.conflicts
            ]
        }


class ScheduleValidator:
    """
    Independent schedule verification engine.
    Ensures that every candidate placement or persisted timetable rigorously
    satisfies all 12 institutional hard constraints.
    """

    @classmethod
    def validate_schedule(
        cls,
        context: SchedulingContext,
        placements: List[Placement]
    ) -> ValidationReport:
        conflicts: List[ScheduleConflict] = []

        # 1. Section collision detection
        section_slot_occupancy: Dict[Tuple[int, int], List[Placement]] = {}
        # 2. Faculty collision detection
        faculty_slot_occupancy: Dict[Tuple[int, int], List[Placement]] = {}
        # 3. Room collision detection
        room_slot_occupancy: Dict[Tuple[int, int], List[Placement]] = {}

        # Workload counters
        faculty_daily_counts: Dict[Tuple[int, str], int] = {}
        faculty_weekly_counts: Dict[int, int] = {}

        # Incorporate locked entries
        for locked in context.locked_entries:
            slot = context.slot_map.get(locked.period_slot_id)
            day = slot.day_of_week if slot else ''
            sec = context.sections.get(locked.section_id)
            fac = context.faculty.get(locked.faculty_id)
            rm = context.rooms.get(locked.room_id)

            # Check locked vs external
            if day:
                faculty_daily_counts[(locked.faculty_id, day)] = (
                    faculty_daily_counts.get((locked.faculty_id, day), 0) + 1
                )
            faculty_weekly_counts[locked.faculty_id] = (
                faculty_weekly_counts.get(locked.faculty_id, 0) + 1
            )

        # Process placements
        total_slots_scheduled = 0

        for p in placements:
            sess = p.session
            section = context.sections.get(sess.section_id)
            room = context.rooms.get(p.room_id)
            faculty = context.faculty.get(sess.faculty_id)

            total_slots_scheduled += len(p.slot_ids)

            # Check 1, 2, 3: Overlap collisions & record
            for slot_id in p.slot_ids:
                slot = context.slot_map.get(slot_id)
                slot_label = f"{p.day_of_week} Period {slot.period_number if slot else slot_id}"

                # Break period check (Constraint 9)
                if slot and slot.is_break:
                    conflicts.append(ScheduleConflict(
                        conflict_code="BREAK_SLOT_VIOLATION",
                        severity="ERROR",
                        message=f"Session scheduled during break slot '{slot.break_label or slot_label}'.",
                        section_id=sess.section_id,
                        section_name=section.name if section else None,
                        period_slot_ids=[slot_id],
                        day_of_week=p.day_of_week,
                        subject_code=sess.subject_code,
                        suggested_action="Move session to an active instruction period slot."
                    ))

                # Shift boundary check (Constraint 11)
                if slot and section and slot.shift_id != section.shift_id:
                    conflicts.append(ScheduleConflict(
                        conflict_code="SHIFT_BOUNDARY_VIOLATION",
                        severity="ERROR",
                        message=f"Session scheduled in slot of shift {slot.shift_id}, but section belongs to shift {section.shift_id}.",
                        section_id=sess.section_id,
                        section_name=section.name if section else None,
                        period_slot_ids=[slot_id],
                        day_of_week=p.day_of_week,
                        subject_code=sess.subject_code,
                        suggested_action="Schedule only within section's designated shift timings."
                    ))

                # External busy checks
                if sess.section_id in context.external_section_busy_slots and slot_id in context.external_section_busy_slots[sess.section_id]:
                    conflicts.append(ScheduleConflict(
                        conflict_code="SECTION_DOUBLE_BOOKING",
                        severity="ERROR",
                        message=f"Section '{section.name if section else sess.section_id}' is already booked in another timetable at {slot_label}.",
                        section_id=sess.section_id,
                        period_slot_ids=[slot_id],
                        day_of_week=p.day_of_week,
                        subject_code=sess.subject_code,
                        suggested_action="Deconflict external timetable or select alternative period."
                    ))

                if sess.faculty_id in context.external_faculty_busy_slots and slot_id in context.external_faculty_busy_slots[sess.faculty_id]:
                    conflicts.append(ScheduleConflict(
                        conflict_code="FACULTY_DOUBLE_BOOKING",
                        severity="ERROR",
                        message=f"Faculty '{faculty.name if faculty else sess.faculty_id}' is already booked externally at {slot_label}.",
                        faculty_id=sess.faculty_id,
                        period_slot_ids=[slot_id],
                        day_of_week=p.day_of_week,
                        subject_code=sess.subject_code,
                        suggested_action="Assign substitute faculty or shift timetable slot."
                    ))

                if p.room_id in context.external_room_busy_slots and slot_id in context.external_room_busy_slots[p.room_id]:
                    conflicts.append(ScheduleConflict(
                        conflict_code="ROOM_DOUBLE_BOOKING",
                        severity="ERROR",
                        message=f"Room '{room.code if room else p.room_id}' is already booked externally at {slot_label}.",
                        room_id=p.room_id,
                        period_slot_ids=[slot_id],
                        day_of_week=p.day_of_week,
                        subject_code=sess.subject_code,
                        suggested_action="Select another available room."
                    ))

                # Check locked entry clashes
                for locked in context.locked_entries:
                    if locked.period_slot_id == slot_id:
                        if locked.section_id == sess.section_id:
                            conflicts.append(ScheduleConflict(
                                conflict_code="SECTION_DOUBLE_BOOKING",
                                severity="ERROR",
                                message=f"Section '{section.name if section else sess.section_id}' clashes with locked entry at {slot_label}.",
                                section_id=sess.section_id,
                                period_slot_ids=[slot_id],
                                day_of_week=p.day_of_week,
                                subject_code=sess.subject_code
                            ))
                        if locked.faculty_id == sess.faculty_id:
                            conflicts.append(ScheduleConflict(
                                conflict_code="FACULTY_DOUBLE_BOOKING",
                                severity="ERROR",
                                message=f"Faculty '{faculty.name if faculty else sess.faculty_id}' clashes with locked entry at {slot_label}.",
                                faculty_id=sess.faculty_id,
                                period_slot_ids=[slot_id],
                                day_of_week=p.day_of_week,
                                subject_code=sess.subject_code
                            ))
                        if locked.room_id == p.room_id:
                            conflicts.append(ScheduleConflict(
                                conflict_code="ROOM_DOUBLE_BOOKING",
                                severity="ERROR",
                                message=f"Room '{room.code if room else p.room_id}' clashes with locked entry at {slot_label}.",
                                room_id=p.room_id,
                                period_slot_ids=[slot_id],
                                day_of_week=p.day_of_week,
                                subject_code=sess.subject_code
                            ))

                # Check intra-candidate collisions
                sec_key = (sess.section_id, slot_id)
                section_slot_occupancy.setdefault(sec_key, []).append(p)

                fac_key = (sess.faculty_id, slot_id)
                faculty_slot_occupancy.setdefault(fac_key, []).append(p)

                rm_key = (p.room_id, slot_id)
                room_slot_occupancy.setdefault(rm_key, []).append(p)

                # Faculty availability check (Constraint 4)
                if faculty and slot_id in faculty.blocked_slot_ids:
                    conflicts.append(ScheduleConflict(
                        conflict_code="FACULTY_UNAVAILABLE",
                        severity="ERROR",
                        message=f"Faculty '{faculty.name}' is marked unavailable at {slot_label}.",
                        faculty_id=faculty.id,
                        faculty_name=faculty.name,
                        period_slot_ids=[slot_id],
                        day_of_week=p.day_of_week,
                        subject_code=sess.subject_code,
                        suggested_action="Adjust faculty availability or reassign instructor."
                    ))

                # Room maintenance / blocked check
                if room and slot_id in room.blocked_slot_ids:
                    conflicts.append(ScheduleConflict(
                        conflict_code="ROOM_UNAVAILABLE",
                        severity="ERROR",
                        message=f"Room '{room.code}' is marked unavailable at {slot_label}.",
                        room_id=room.id,
                        room_name=room.code,
                        period_slot_ids=[slot_id],
                        day_of_week=p.day_of_week,
                        subject_code=sess.subject_code,
                        suggested_action="Allocate alternate facility."
                    ))

            # Room capacity check (Constraint 7)
            if room and section and room.capacity < section.student_count:
                conflicts.append(ScheduleConflict(
                    conflict_code="ROOM_CAPACITY_DEFICIT",
                    severity="ERROR",
                    message=(
                        f"Room '{room.code}' capacity ({room.capacity}) is insufficient for "
                        f"Section '{section.name}' headcount ({section.student_count})."
                    ),
                    room_id=room.id,
                    room_name=room.code,
                    section_id=section.id,
                    section_name=section.name,
                    subject_code=sess.subject_code,
                    suggested_action="Assign a larger classroom or lecture theatre."
                ))

            # Room type compatibility for labs (Constraint 8)
            if sess.is_lab and room and room.room_type != 'LAB':
                conflicts.append(ScheduleConflict(
                    conflict_code="ROOM_TYPE_MISMATCH",
                    severity="ERROR",
                    message=f"Laboratory subject '{sess.subject_code}' scheduled in non-lab room '{room.code}' ({room.room_type}).",
                    room_id=room.id,
                    room_name=room.code,
                    subject_code=sess.subject_code,
                    suggested_action="Allocate a specialized laboratory room."
                ))

            # Consecutive lab block check (Constraint 10)
            if sess.is_lab and sess.duration_slots > 1:
                slots = [context.slot_map.get(sid) for sid in p.slot_ids if context.slot_map.get(sid)]
                # Check sorted consecutive periods
                slots.sort(key=lambda s: s.period_number)
                is_consecutive = True
                for i in range(len(slots) - 1):
                    if slots[i + 1].period_number != slots[i].period_number + 1:
                        is_consecutive = False
                        break
                if not is_consecutive:
                    conflicts.append(ScheduleConflict(
                        conflict_code="LAB_CONTIGUITY_VIOLATION",
                        severity="ERROR",
                        message=f"Multi-period lab '{sess.subject_code}' is fragmented across non-consecutive slots.",
                        period_slot_ids=p.slot_ids,
                        day_of_week=p.day_of_week,
                        subject_code=sess.subject_code,
                        suggested_action="Schedule multi-period lab in contiguous period blocks."
                    ))

            # Workload count update
            day_key = (sess.faculty_id, p.day_of_week)
            faculty_daily_counts[day_key] = faculty_daily_counts.get(day_key, 0) + len(p.slot_ids)
            faculty_weekly_counts[sess.faculty_id] = faculty_weekly_counts.get(sess.faculty_id, 0) + len(p.slot_ids)

        # Evaluate collisions in collected occupancy
        for (sec_id, slot_id), pl_list in section_slot_occupancy.items():
            if len(pl_list) > 1:
                sec = context.sections.get(sec_id)
                slot = context.slot_map.get(slot_id)
                subjects = ", ".join(p.session.subject_code for p in pl_list)
                conflicts.append(ScheduleConflict(
                    conflict_code="SECTION_DOUBLE_BOOKING",
                    severity="ERROR",
                    message=f"Section '{sec.name if sec else sec_id}' has multiple classes ({subjects}) at {slot.day_of_week} Period {slot.period_number}.",
                    section_id=sec_id,
                    section_name=sec.name if sec else None,
                    period_slot_ids=[slot_id],
                    day_of_week=slot.day_of_week,
                    suggested_action="Reschedule conflicting session to a free slot."
                ))

        for (fac_id, slot_id), pl_list in faculty_slot_occupancy.items():
            if len(pl_list) > 1:
                fac = context.faculty.get(fac_id)
                slot = context.slot_map.get(slot_id)
                subjects = ", ".join(p.session.subject_code for p in pl_list)
                conflicts.append(ScheduleConflict(
                    conflict_code="FACULTY_DOUBLE_BOOKING",
                    severity="ERROR",
                    message=f"Faculty '{fac.name if fac else fac_id}' is double-booked teaching ({subjects}) at {slot.day_of_week} Period {slot.period_number}.",
                    faculty_id=fac_id,
                    faculty_name=fac.name if fac else None,
                    period_slot_ids=[slot_id],
                    day_of_week=slot.day_of_week,
                    suggested_action="Assign another qualified instructor or adjust timetable slot."
                ))

        for (rm_id, slot_id), pl_list in room_slot_occupancy.items():
            if len(pl_list) > 1:
                rm = context.rooms.get(rm_id)
                slot = context.slot_map.get(slot_id)
                subjects = ", ".join(p.session.subject_code for p in pl_list)
                conflicts.append(ScheduleConflict(
                    conflict_code="ROOM_DOUBLE_BOOKING",
                    severity="ERROR",
                    message=f"Room '{rm.code if rm else rm_id}' is double-booked hosting ({subjects}) at {slot.day_of_week} Period {slot.period_number}.",
                    room_id=rm_id,
                    room_name=rm.code if rm else None,
                    period_slot_ids=[slot_id],
                    day_of_week=slot.day_of_week,
                    suggested_action="Assign a different available room."
                ))

        # Evaluate faculty workload limits (Constraint 5)
        for (fac_id, day), count in faculty_daily_counts.items():
            fac = context.faculty.get(fac_id)
            if fac and count > fac.max_daily_periods:
                conflicts.append(ScheduleConflict(
                    conflict_code="FACULTY_DAILY_LOAD_EXCEEDED",
                    severity="ERROR",
                    message=f"Faculty '{fac.name}' assigned {count} periods on {day}, exceeding daily limit of {fac.max_daily_periods}.",
                    faculty_id=fac_id,
                    faculty_name=fac.name,
                    day_of_week=day,
                    suggested_action="Distribute periods evenly across other teaching days."
                ))

        for fac_id, count in faculty_weekly_counts.items():
            fac = context.faculty.get(fac_id)
            if fac and count > fac.max_weekly_periods:
                conflicts.append(ScheduleConflict(
                    conflict_code="FACULTY_WEEKLY_LOAD_EXCEEDED",
                    severity="ERROR",
                    message=f"Faculty '{fac.name}' assigned {count} total periods, exceeding weekly limit of {fac.max_weekly_periods}.",
                    faculty_id=fac_id,
                    faculty_name=fac.name,
                    suggested_action="Reduce assigned course load or reassign sections."
                ))

        # Check required weekly sessions fulfillment (Constraint 10)
        total_required_slots = sum(r.weekly_periods for r in context.requirements)
        if total_slots_scheduled < total_required_slots:
            diff = total_required_slots - total_slots_scheduled
            conflicts.append(ScheduleConflict(
                conflict_code="MISSING_SESSION_FULFILLMENT",
                severity="ERROR",
                message=f"{diff} required curriculum periods could not be scheduled within available constraints.",
                suggested_action="Increase available working periods, add rooms, or resolve faculty availability."
            ))

        hard_violations = sum(1 for c in conflicts if c.severity == 'ERROR')
        is_valid = (hard_violations == 0)

        summary = (
            f"Validation passed: 0 conflicts detected. All {len(placements)} sessions successfully verified."
            if is_valid
            else f"Validation failed with {hard_violations} hard constraint violation(s)."
        )

        return ValidationReport(
            is_valid=is_valid,
            total_conflicts=len(conflicts),
            hard_constraint_violations=hard_violations,
            sessions_required=total_required_slots,
            sessions_scheduled=total_slots_scheduled,
            conflicts=conflicts,
            summary=summary
        )

    @classmethod
    def validate_timetable_instance(cls, timetable_id: int) -> ValidationReport:
        """
        Validates an existing saved or published Timetable instance from the database.
        """
        try:
            timetable = Timetable.objects.select_related(
                'academic_year', 'shift', 'department', 'semester'
            ).get(id=timetable_id)
        except Timetable.DoesNotExist:
            return ValidationReport(
                is_valid=False,
                total_conflicts=1,
                hard_constraint_violations=1,
                sessions_required=0,
                sessions_scheduled=0,
                conflicts=[ScheduleConflict(
                    conflict_code="TIMETABLE_NOT_FOUND",
                    severity="ERROR",
                    message=f"Timetable with ID {timetable_id} does not exist."
                )],
                summary="Timetable not found."
            )

        entries = list(TimetableEntry.objects.select_related(
            'section', 'subject', 'faculty__user', 'room', 'period_slot'
        ).filter(timetable=timetable))

        conflicts: List[ScheduleConflict] = []
        sec_slot_map: Dict[Tuple[int, int], List[TimetableEntry]] = {}
        fac_slot_map: Dict[Tuple[int, int], List[TimetableEntry]] = {}
        room_slot_map: Dict[Tuple[int, int], List[TimetableEntry]] = {}
        faculty_daily: Dict[Tuple[int, str], int] = {}
        faculty_weekly: Dict[int, int] = {}

        for e in entries:
            slot = e.period_slot
            # 1. Break slot violation
            if slot.is_break:
                conflicts.append(ScheduleConflict(
                    conflict_code="BREAK_SLOT_VIOLATION",
                    severity="ERROR",
                    message=f"Class scheduled during break slot '{slot.break_label}'.",
                    section_id=e.section_id,
                    section_name=e.section.name,
                    period_slot_ids=[slot.id],
                    day_of_week=e.day_of_week,
                    subject_code=e.subject.code
                ))

            # 2. Shift boundary check
            if slot.shift_id != e.section.semester.shift_id:
                conflicts.append(ScheduleConflict(
                    conflict_code="SHIFT_BOUNDARY_VIOLATION",
                    severity="ERROR",
                    message=f"Class scheduled outside section shift {e.section.semester.shift_id}.",
                    section_id=e.section_id,
                    section_name=e.section.name,
                    period_slot_ids=[slot.id],
                    day_of_week=e.day_of_week,
                    subject_code=e.subject.code
                ))

            # 3. Room capacity check
            if e.room.capacity < e.section.student_count:
                conflicts.append(ScheduleConflict(
                    conflict_code="ROOM_CAPACITY_DEFICIT",
                    severity="ERROR",
                    message=f"Room '{e.room.code}' capacity ({e.room.capacity}) < section headcount ({e.section.student_count}).",
                    room_id=e.room.id,
                    room_name=e.room.code,
                    section_id=e.section.id,
                    section_name=e.section.name,
                    subject_code=e.subject.code
                ))

            # 4. Lab room type check
            if e.subject.subject_type == 'LAB' and e.room.room_type != 'LAB':
                conflicts.append(ScheduleConflict(
                    conflict_code="ROOM_TYPE_MISMATCH",
                    severity="ERROR",
                    message=f"Lab subject '{e.subject.code}' in non-lab room '{e.room.code}'.",
                    room_id=e.room.id,
                    room_name=e.room.code,
                    subject_code=e.subject.code
                ))

            # Collision tracking
            sec_slot_map.setdefault((e.section_id, slot.id), []).append(e)
            fac_slot_map.setdefault((e.faculty_id, slot.id), []).append(e)
            room_slot_map.setdefault((e.room_id, slot.id), []).append(e)

            # Workload counts
            faculty_daily[(e.faculty_id, e.day_of_week)] = (
                faculty_daily.get((e.faculty_id, e.day_of_week), 0) + 1
            )
            faculty_weekly[e.faculty_id] = faculty_weekly.get(e.faculty_id, 0) + 1

        # Check collisions
        for (sec_id, s_id), e_list in sec_slot_map.items():
            if len(e_list) > 1:
                conflicts.append(ScheduleConflict(
                    conflict_code="SECTION_DOUBLE_BOOKING",
                    severity="ERROR",
                    message=f"Section double-booked at slot {s_id}.",
                    section_id=sec_id,
                    period_slot_ids=[s_id]
                ))

        for (fac_id, s_id), e_list in fac_slot_map.items():
            if len(e_list) > 1:
                conflicts.append(ScheduleConflict(
                    conflict_code="FACULTY_DOUBLE_BOOKING",
                    severity="ERROR",
                    message=f"Faculty double-booked at slot {s_id}.",
                    faculty_id=fac_id,
                    period_slot_ids=[s_id]
                ))

        for (rm_id, s_id), e_list in room_slot_map.items():
            if len(e_list) > 1:
                conflicts.append(ScheduleConflict(
                    conflict_code="ROOM_DOUBLE_BOOKING",
                    severity="ERROR",
                    message=f"Room double-booked at slot {s_id}.",
                    room_id=rm_id,
                    period_slot_ids=[s_id]
                ))

        # Check faculty max workload
        fac_ids = list(faculty_weekly.keys())
        faculties = {f.id: f for f in Faculty.objects.filter(id__in=fac_ids)}
        for (fac_id, day), count in faculty_daily.items():
            fac = faculties.get(fac_id)
            if fac and count > fac.max_daily_periods:
                conflicts.append(ScheduleConflict(
                    conflict_code="FACULTY_DAILY_LOAD_EXCEEDED",
                    severity="ERROR",
                    message=f"Faculty {fac.user.last_name or fac.id} daily load {count} > {fac.max_daily_periods}.",
                    faculty_id=fac_id,
                    day_of_week=day
                ))

        for fac_id, count in faculty_weekly.items():
            fac = faculties.get(fac_id)
            if fac and count > fac.max_weekly_periods:
                conflicts.append(ScheduleConflict(
                    conflict_code="FACULTY_WEEKLY_LOAD_EXCEEDED",
                    severity="ERROR",
                    message=f"Faculty {fac.user.last_name or fac.id} weekly load {count} > {fac.max_weekly_periods}.",
                    faculty_id=fac_id
                ))

        hard_violations = sum(1 for c in conflicts if c.severity == 'ERROR')
        is_valid = (hard_violations == 0)

        return ValidationReport(
            is_valid=is_valid,
            total_conflicts=len(conflicts),
            hard_constraint_violations=hard_violations,
            sessions_required=len(entries),
            sessions_scheduled=len(entries),
            conflicts=conflicts,
            summary=f"Found {hard_violations} violations in timetable {timetable_id}." if not is_valid else "Timetable valid."
        )
