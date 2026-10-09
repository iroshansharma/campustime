import uuid
from dataclasses import dataclass
from typing import List, Optional
from .requirement_loader import SchedulingContext, AssignmentRequirement


@dataclass
class SchedulableSession:
    """
    An atomic schedulable class meeting.
    Can span 1 period (theory) or multiple consecutive periods (lab).
    """
    session_id: str
    section_id: int
    subject_id: int
    faculty_id: int
    subject_code: str
    subject_name: str
    subject_type: str
    duration_slots: int
    is_lab: bool
    min_capacity_required: int
    section_shift_id: int
    linked_group_id: Optional[uuid.UUID] = None

    @property
    def key(self) -> str:
        return self.session_id


class SessionExpander:
    """
    Expands weekly curriculum assignments into individual atomic SchedulableSessions.
    Handles continuous laboratory blocks and creates linked UUIDs.
    """

    @staticmethod
    def expand_requirements(context: SchedulingContext) -> List[SchedulableSession]:
        sessions: List[SchedulableSession] = []

        for req in context.requirements:
            section = context.sections.get(req.section_id)
            if not section:
                continue

            weekly_needed = req.weekly_periods
            consecutive = req.consecutive_slots if req.consecutive_slots > 0 else 1
            is_lab = (req.subject_type == 'LAB')
            session_idx = 1

            while weekly_needed > 0:
                duration = min(consecutive, weekly_needed)
                linked_id = uuid.uuid4() if duration > 1 else None

                session_id = f"SEC{req.section_id}_SUB{req.subject_id}_S{session_idx}"
                sessions.append(SchedulableSession(
                    session_id=session_id,
                    section_id=req.section_id,
                    subject_id=req.subject_id,
                    faculty_id=req.faculty_id,
                    subject_code=req.subject_code,
                    subject_name=req.subject_name,
                    subject_type=req.subject_type,
                    duration_slots=duration,
                    is_lab=is_lab,
                    min_capacity_required=section.student_count,
                    section_shift_id=section.shift_id,
                    linked_group_id=linked_id
                ))

                weekly_needed -= duration
                session_idx += 1

        return sessions
