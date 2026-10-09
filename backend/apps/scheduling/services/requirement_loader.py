from dataclasses import dataclass, field
from datetime import time
from typing import List, Dict, Set, Optional
from django.db.models import Q

from apps.academics.models import PeriodSlot, Section, Subject, Semester
from apps.faculty.models import Faculty, FacultyAvailability, FacultySubjectQualification, SectionSubjectAssignment
from apps.rooms.models import Room, RoomAvailability
from apps.timetables.models import Timetable, TimetableEntry


@dataclass
class SlotData:
    id: int
    shift_id: int
    day_of_week: str
    period_number: int
    start_time: time
    end_time: time
    is_break: bool
    break_label: str = ''


@dataclass
class RoomData:
    id: int
    code: str
    name: str
    room_type: str  # CLASSROOM, LAB, SEMINAR_HALL
    capacity: int
    department_id: Optional[int] = None
    blocked_slot_ids: Set[int] = field(default_factory=set)


@dataclass
class FacultyData:
    id: int
    name: str
    employee_id: str
    max_weekly_periods: int
    max_daily_periods: int
    available_slot_ids: Set[int] = field(default_factory=set)
    preferred_slot_ids: Set[int] = field(default_factory=set)
    blocked_slot_ids: Set[int] = field(default_factory=set)
    qualifications: Dict[int, int] = field(default_factory=dict)  # subject_id -> preference_level (1..5)


@dataclass
class SectionData:
    id: int
    name: str
    semester_id: int
    department_id: int
    shift_id: int
    student_count: int


@dataclass
class AssignmentRequirement:
    id: int
    section_id: int
    subject_id: int
    faculty_id: int
    subject_code: str
    subject_name: str
    subject_type: str  # THEORY, LAB, SEMINAR
    weekly_periods: int
    consecutive_slots: int
    is_primary: bool


@dataclass
class ExistingBooking:
    period_slot_id: int
    section_id: int
    faculty_id: int
    room_id: int
    is_locked: bool
    linked_session_id: Optional[str] = None


@dataclass
class SchedulingScope:
    academic_year_id: int
    shift_id: Optional[int] = None
    department_ids: Optional[List[int]] = None
    semester_ids: Optional[List[int]] = None
    section_ids: Optional[List[int]] = None
    timetable_id: Optional[int] = None


@dataclass
class SchedulingContext:
    scope: SchedulingScope
    sections: Dict[int, SectionData]
    slots: List[SlotData]
    slot_map: Dict[int, SlotData]
    slots_by_day: Dict[str, List[SlotData]]
    consecutive_slots_map: Dict[int, List[int]]  # slot_id -> list of next adjacent slot_ids on same day
    rooms: Dict[int, RoomData]
    faculty: Dict[int, FacultyData]
    requirements: List[AssignmentRequirement]
    locked_entries: List[ExistingBooking]
    external_faculty_busy_slots: Dict[int, Set[int]]  # faculty_id -> busy slots outside scope
    external_room_busy_slots: Dict[int, Set[int]]     # room_id -> busy slots outside scope
    external_section_busy_slots: Dict[int, Set[int]]  # section_id -> busy slots outside scope
    target_timetable: Optional[Timetable] = None


class RequirementLoader:
    """
    Extracts and packages university scheduling requirements and operational constraints
    into a structured in-memory SchedulingContext.
    """

    @staticmethod
    def load_context(scope: SchedulingScope) -> SchedulingContext:
        # 1. Resolve Sections in scope
        sections_qs = Section.objects.select_related(
            'semester__academic_year', 'semester__department__college', 'semester__shift'
        ).filter(semester__academic_year_id=scope.academic_year_id)

        if scope.shift_id:
            sections_qs = sections_qs.filter(semester__shift_id=scope.shift_id)
        if scope.department_ids:
            sections_qs = sections_qs.filter(semester__department_id__in=scope.department_ids)
        if scope.semester_ids:
            sections_qs = sections_qs.filter(semester_id__in=scope.semester_ids)
        if scope.section_ids:
            sections_qs = sections_qs.filter(id__in=scope.section_ids)

        section_map: Dict[int, SectionData] = {}
        college_id: Optional[int] = None
        shift_ids: Set[int] = set()

        for s in sections_qs:
            section_map[s.id] = SectionData(
                id=s.id,
                name=s.name,
                semester_id=s.semester_id,
                department_id=s.semester.department_id,
                shift_id=s.semester.shift_id,
                student_count=s.student_count
            )
            college_id = s.semester.department.college_id
            shift_ids.add(s.semester.shift_id)

        if not section_map:
            # Check if sections exist in the scope but were excluded due to a shift mismatch
            if scope.shift_id:
                mismatch_qs = Section.objects.filter(
                    semester__academic_year_id=scope.academic_year_id
                ).select_related('semester__shift')
                if scope.department_ids:
                    mismatch_qs = mismatch_qs.filter(semester__department_id__in=scope.department_ids)
                if scope.semester_ids:
                    mismatch_qs = mismatch_qs.filter(semester_id__in=scope.semester_ids)
                if scope.section_ids:
                    mismatch_qs = mismatch_qs.filter(id__in=scope.section_ids)

                if mismatch_qs.exists():
                    found_shifts = sorted(list(set(s.semester.shift.name for s in mismatch_qs)))
                    shifts_str = ", ".join(found_shifts)
                    raise ValueError(
                        f"Shift mismatch in scheduling scope: The selected semester/sections belong to '{shifts_str}', "
                        f"but Shift ID {scope.shift_id} was selected. Please set Shift to '{shifts_str}' or 'All Shifts'."
                    )

            scope_desc_parts = [f"academic_year_id={scope.academic_year_id}"]
            if scope.shift_id:
                scope_desc_parts.append(f"shift_id={scope.shift_id}")
            if scope.department_ids:
                scope_desc_parts.append(f"department_ids={scope.department_ids}")
            if scope.semester_ids:
                scope_desc_parts.append(f"semester_ids={scope.semester_ids}")
            if scope.section_ids:
                scope_desc_parts.append(f"section_ids={scope.section_ids}")
            scope_desc = ", ".join(scope_desc_parts)
            raise ValueError(
                f"No sections found for the specified scheduling scope ({scope_desc}). "
                f"Please ensure sections are configured for this department/semester under Academic Management."
            )

        # 2. Resolve Active Period Slots for the relevant shifts
        slots_qs = PeriodSlot.objects.filter(
            shift_id__in=shift_ids
        ).order_by('day_of_week', 'period_number')

        slot_map: Dict[int, SlotData] = {}
        slots_list: List[SlotData] = []
        slots_by_day: Dict[str, List[SlotData]] = {}

        for ps in slots_qs:
            slot_data = SlotData(
                id=ps.id,
                shift_id=ps.shift_id,
                day_of_week=ps.day_of_week,
                period_number=ps.period_number,
                start_time=ps.start_time,
                end_time=ps.end_time,
                is_break=ps.is_break,
                break_label=ps.break_label or ''
            )
            slot_map[ps.id] = slot_data
            slots_list.append(slot_data)
            slots_by_day.setdefault(ps.day_of_week, []).append(slot_data)

        # Precompute consecutive slot pairs (p, p+1 on same day, neither is a break)
        consecutive_slots_map: Dict[int, List[int]] = {}
        for day, d_slots in slots_by_day.items():
            # sort by period_number
            sorted_day_slots = sorted(d_slots, key=lambda s: s.period_number)
            for i in range(len(sorted_day_slots) - 1):
                cur = sorted_day_slots[i]
                nxt = sorted_day_slots[i + 1]
                # Consecutive if period numbers are consecutive and neither is break
                if nxt.period_number == cur.period_number + 1 and not cur.is_break and not nxt.is_break:
                    consecutive_slots_map.setdefault(cur.id, []).append(nxt.id)

        # 3. Resolve Section-Subject Teaching Assignments
        assignments_qs = SectionSubjectAssignment.objects.select_related(
            'subject', 'faculty__user'
        ).filter(section_id__in=list(section_map.keys()))

        requirements: List[AssignmentRequirement] = []
        faculty_ids: Set[int] = set()

        for a in assignments_qs:
            requirements.append(AssignmentRequirement(
                id=a.id,
                section_id=a.section_id,
                subject_id=a.subject_id,
                faculty_id=a.faculty_id,
                subject_code=a.subject.code,
                subject_name=a.subject.name,
                subject_type=a.subject.subject_type,
                weekly_periods=a.subject.weekly_periods,
                consecutive_slots=a.subject.consecutive_slots,
                is_primary=a.is_primary
            ))
            faculty_ids.add(a.faculty_id)

        # 4. Resolve Faculty Profiles & Availability
        faculty_qs = Faculty.objects.select_related('user').filter(id__in=faculty_ids)
        faculty_map: Dict[int, FacultyData] = {}

        for f in faculty_qs:
            faculty_map[f.id] = FacultyData(
                id=f.id,
                name=f.user.get_full_name() or f.user.username,
                employee_id=f.employee_id,
                max_weekly_periods=f.max_weekly_periods,
                max_daily_periods=f.max_daily_periods
            )

        # Load availability and preferences
        avail_qs = FacultyAvailability.objects.filter(faculty_id__in=faculty_ids)
        for av in avail_qs:
            f_data = faculty_map.get(av.faculty_id)
            if not f_data:
                continue
            if not av.is_available:
                f_data.blocked_slot_ids.add(av.period_slot_id)
            else:
                f_data.available_slot_ids.add(av.period_slot_id)
                if av.is_preferred:
                    f_data.preferred_slot_ids.add(av.period_slot_id)

        # Load Qualifications
        qual_qs = FacultySubjectQualification.objects.filter(faculty_id__in=faculty_ids)
        for q in qual_qs:
            f_data = faculty_map.get(q.faculty_id)
            if f_data:
                f_data.qualifications[q.subject_id] = q.preference_level

        # 5. Resolve Rooms
        rooms_qs = Room.objects.filter(college_id=college_id, is_active=True)
        room_map: Dict[int, RoomData] = {}
        for r in rooms_qs:
            room_map[r.id] = RoomData(
                id=r.id,
                code=r.code,
                name=r.name,
                room_type=r.room_type,
                capacity=r.capacity,
                department_id=r.department_id
            )

        # Room availability overrides
        room_avail_qs = RoomAvailability.objects.filter(
            room_id__in=list(room_map.keys()), is_available=False
        )
        for rav in room_avail_qs:
            if rav.room_id in room_map:
                room_map[rav.room_id].blocked_slot_ids.add(rav.period_slot_id)

        # 6. Resolve Target Timetable and Locked Entries
        target_timetable = None
        locked_entries: List[ExistingBooking] = []
        ext_fac_busy: Dict[int, Set[int]] = {}
        ext_room_busy: Dict[int, Set[int]] = {}
        ext_sec_busy: Dict[int, Set[int]] = {}

        if scope.timetable_id:
            try:
                target_timetable = Timetable.objects.get(pk=scope.timetable_id)
                # Locked entries within this timetable
                entries_qs = TimetableEntry.objects.filter(
                    timetable=target_timetable, is_locked=True
                )
                for entry in entries_qs:
                    locked_entries.append(ExistingBooking(
                        period_slot_id=entry.period_slot_id,
                        section_id=entry.section_id,
                        faculty_id=entry.faculty_id,
                        room_id=entry.room_id,
                        is_locked=True,
                        linked_session_id=str(entry.linked_session_id) if entry.linked_session_id else None
                    ))
            except Timetable.DoesNotExist:
                pass

        # Protect against double-booking shared resources in OTHER active/published timetables
        # in the same academic year (Draft timetables do not lock shared resources)
        other_entries_qs = TimetableEntry.objects.filter(
            timetable__academic_year_id=scope.academic_year_id,
            timetable__status=Timetable.Status.PUBLISHED
        )
        if target_timetable:
            other_entries_qs = other_entries_qs.exclude(timetable=target_timetable)

        # Check existing commitments for our faculty, rooms, or sections
        other_entries_qs = other_entries_qs.filter(
            Q(faculty_id__in=faculty_ids) |
            Q(room_id__in=list(room_map.keys())) |
            Q(section_id__in=list(section_map.keys()))
        )

        for oe in other_entries_qs:
            ext_fac_busy.setdefault(oe.faculty_id, set()).add(oe.period_slot_id)
            ext_room_busy.setdefault(oe.room_id, set()).add(oe.period_slot_id)
            ext_sec_busy.setdefault(oe.section_id, set()).add(oe.period_slot_id)

        return SchedulingContext(
            scope=scope,
            sections=section_map,
            slots=slots_list,
            slot_map=slot_map,
            slots_by_day=slots_by_day,
            consecutive_slots_map=consecutive_slots_map,
            rooms=room_map,
            faculty=faculty_map,
            requirements=requirements,
            locked_entries=locked_entries,
            external_faculty_busy_slots=ext_fac_busy,
            external_room_busy_slots=ext_room_busy,
            external_section_busy_slots=ext_sec_busy,
            target_timetable=target_timetable
        )
