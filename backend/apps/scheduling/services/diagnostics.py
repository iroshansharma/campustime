from dataclasses import dataclass, field
from typing import List, Dict, Optional

from .requirement_loader import SchedulingContext
from .session_expander import SchedulableSession
from .placement_generator import Placement
from .validator import ScheduleConflict, ValidationReport


@dataclass
class DiagnosticBottleneck:
    category: str  # 'ROOM_CAPACITY', 'ROOM_TYPE', 'FACULTY_AVAILABILITY', 'WORKLOAD_LIMIT', 'SLOT_SATURATION'
    summary: str
    affected_entity: str
    suggested_action: str


class ConflictDiagnosticsService:
    """
    Analyzes generation failures, constraint deadlocks, and unassigned sessions
    to pinpoint operational bottlenecks and guide administrative resolution.
    """

    @classmethod
    def analyze_generation_failure(
        cls,
        context: SchedulingContext,
        unassigned_sessions: List[SchedulableSession],
        initial_domains: Dict[str, List[Placement]],
        report: Optional[ValidationReport] = None
    ) -> List[DiagnosticBottleneck]:
        bottlenecks: List[DiagnosticBottleneck] = []

        # 1. Inspect sessions with empty or near-empty initial candidate domains
        for sess in unassigned_sessions:
            domain = initial_domains.get(sess.session_id, [])
            section = context.sections.get(sess.section_id)
            faculty = context.faculty.get(sess.faculty_id)

            if len(domain) == 0:
                # Check classroom / lecture hall capacity deficit for theory sessions
                if not sess.is_lab:
                    suitable_rooms = [
                        r for r in context.rooms.values()
                        if r.room_type in ['CLASSROOM', 'SEMINAR_HALL'] and r.capacity >= sess.min_capacity_required
                    ]
                    if not suitable_rooms:
                        bottlenecks.append(DiagnosticBottleneck(
                            category="ROOM_CAPACITY",
                            summary=(
                                f"No classroom in inventory has sufficient capacity ({sess.min_capacity_required}+) "
                                f"for Section '{section.name if section else sess.section_id}'."
                            ),
                            affected_entity=f"Section {section.name if section else sess.section_id}",
                            suggested_action="Add a larger classroom or reduce section student batch size."
                        ))

                # Check laboratory room type and capacity
                if sess.is_lab:
                    lab_rooms = [
                        r for r in context.rooms.values()
                        if r.room_type == 'LAB' and r.capacity >= sess.min_capacity_required
                    ]
                    if not lab_rooms:
                        bottlenecks.append(DiagnosticBottleneck(
                            category="ROOM_TYPE",
                            summary=(
                                f"No LAB room with capacity {sess.min_capacity_required}+ is available for "
                                f"lab subject '{sess.subject_code}'."
                            ),
                            affected_entity=f"Subject {sess.subject_code}",
                            suggested_action="Configure dedicated laboratory rooms or increase existing lab room capacity."
                        ))

                # Check faculty availability saturation
                if faculty:
                    shift_slots = [
                        s.id for s in context.slots
                        if s.shift_id == sess.section_shift_id and not s.is_break
                    ]
                    unblocked_slots = [
                        sid for sid in shift_slots
                        if sid not in faculty.blocked_slot_ids
                        and sid not in context.external_faculty_busy_slots.get(sess.faculty_id, set())
                    ]
                    if len(unblocked_slots) < sess.duration_slots:
                        bottlenecks.append(DiagnosticBottleneck(
                            category="FACULTY_AVAILABILITY",
                            summary=(
                                f"Faculty '{faculty.name}' has fewer unblocked periods ({len(unblocked_slots)}) "
                                f"than session duration ({sess.duration_slots}) in Shift {sess.section_shift_id}."
                            ),
                            affected_entity=f"Faculty {faculty.name}",
                            suggested_action="Expand faculty availability periods or assign another instructor."
                        ))

                    if faculty.max_weekly_periods < sess.duration_slots:
                        bottlenecks.append(DiagnosticBottleneck(
                            category="WORKLOAD_LIMIT",
                            summary=(
                                f"Faculty '{faculty.name}' weekly limit ({faculty.max_weekly_periods}) "
                                f"cannot accommodate required session duration ({sess.duration_slots})."
                            ),
                            affected_entity=f"Faculty {faculty.name}",
                            suggested_action="Increase faculty max weekly teaching periods."
                        ))

        # 2. Check overall section period saturation
        for sec_id, sec_data in context.sections.items():
            req_periods = sum(r.weekly_periods for r in context.requirements if r.section_id == sec_id)
            avail_slots = len([
                s for s in context.slots
                if s.shift_id == sec_data.shift_id and not s.is_break
            ])
            if req_periods > avail_slots:
                bottlenecks.append(DiagnosticBottleneck(
                    category="SLOT_SATURATION",
                    summary=(
                        f"Section '{sec_data.name}' requires {req_periods} periods/week, "
                        f"exceeding the total active shift capacity of {avail_slots} slots."
                    ),
                    affected_entity=f"Section {sec_data.name}",
                    suggested_action="Add working days or periods, or reduce weekly subject allocations."
                ))

        return bottlenecks
