from dataclasses import dataclass
from typing import List, Dict, Optional, Tuple
from .requirement_loader import SchedulingContext, SlotData, RoomData, FacultyData
from .session_expander import SchedulableSession


@dataclass
class Placement:
    session: SchedulableSession
    slot_ids: List[int]
    room_id: int
    day_of_week: str
    score: float = 0.0

    @property
    def start_slot_id(self) -> int:
        return self.slot_ids[0]


class PlacementGenerator:
    """
    Generates and filters candidate placements for each SchedulableSession
    based on shift boundaries, contiguous multi-period blocks, room capacity,
    room type, and faculty availability.
    """

    @staticmethod
    def generate_candidate_domains(
        sessions: List[SchedulableSession],
        context: SchedulingContext
    ) -> Dict[str, List[Placement]]:
        domains: Dict[str, List[Placement]] = {}

        # Precompute candidate slot sequences per shift and day
        # sequences_by_shift_and_duration: Dict[(shift_id, duration), List[List[SlotData]]]
        sequences_cache: Dict[Tuple[int, int], List[List[SlotData]]] = {}

        for sess in sessions:
            key = (sess.section_shift_id, sess.duration_slots)
            if key not in sequences_cache:
                sequences_cache[key] = PlacementGenerator._find_valid_slot_sequences(
                    shift_id=sess.section_shift_id,
                    duration=sess.duration_slots,
                    context=context
                )

            valid_seqs = sequences_cache[key]
            placements: List[Placement] = []

            fac_data = context.faculty.get(sess.faculty_id)
            fac_pref_level = fac_data.qualifications.get(sess.subject_id, 3) if fac_data else 3

            # Filter rooms that match type and capacity
            suitable_rooms: List[RoomData] = []
            for r in context.rooms.values():
                if sess.is_lab and r.room_type != 'LAB':
                    continue
                if not sess.is_lab and r.room_type not in ['CLASSROOM', 'SEMINAR_HALL']:
                    continue
                if r.capacity < sess.min_capacity_required:
                    continue
                # If room is dedicated to a department, verify section belongs to that department
                section_data = context.sections.get(sess.section_id)
                if r.department_id and section_data and r.department_id != section_data.department_id:
                    continue
                suitable_rooms.append(r)

            for seq in valid_seqs:
                slot_ids = [s.id for s in seq]
                day = seq[0].day_of_week

                # 1. Faculty availability check for this sequence
                if fac_data:
                    # Check if faculty has explicitly blocked any slot in this sequence
                    if any(sid in fac_data.blocked_slot_ids for sid in slot_ids):
                        continue
                    # Check if faculty is busy externally outside scope
                    ext_fac_busy = context.external_faculty_busy_slots.get(sess.faculty_id, set())
                    if any(sid in ext_fac_busy for sid in slot_ids):
                        continue

                # 2. Section external busy check
                ext_sec_busy = context.external_section_busy_slots.get(sess.section_id, set())
                if any(sid in ext_sec_busy for sid in slot_ids):
                    continue

                # 3. For each suitable room, check availability
                for room in suitable_rooms:
                    # Check room maintenance / overrides
                    if any(sid in room.blocked_slot_ids for sid in slot_ids):
                        continue
                    # Check room busy externally
                    ext_room_busy = context.external_room_busy_slots.get(room.id, set())
                    if any(sid in ext_room_busy for sid in slot_ids):
                        continue

                    # Calculate soft preference score
                    score = 0.0
                    if fac_data:
                        # Bonus if any slot is marked preferred by faculty
                        pref_matches = sum(1 for sid in slot_ids if sid in fac_data.preferred_slot_ids)
                        score += pref_matches * 10.0
                        score += fac_pref_level * 2.0

                    # Slight bonus for middle-of-the-day periods, avoiding excessive early/late fragmentation
                    avg_period_num = sum(s.period_number for s in seq) / len(seq)
                    score -= abs(avg_period_num - 3.0) * 0.5

                    placements.append(Placement(
                        session=sess,
                        slot_ids=slot_ids,
                        room_id=room.id,
                        day_of_week=day,
                        score=score
                    ))

            # Sort placements for this session by descending score (best soft preferences first)
            placements.sort(key=lambda p: p.score, reverse=True)
            domains[sess.session_id] = placements

        return domains

    @staticmethod
    def _find_valid_slot_sequences(
        shift_id: int,
        duration: int,
        context: SchedulingContext
    ) -> List[List[SlotData]]:
        """
        Finds all contiguous non-break slot sequences of length `duration`
        on the same day within the given shift.
        """
        sequences: List[List[SlotData]] = []

        for day, slots in context.slots_by_day.items():
            # Filter slots for this shift and non-break
            shift_slots = [s for s in slots if s.shift_id == shift_id and not s.is_break]
            shift_slots.sort(key=lambda s: s.period_number)

            if len(shift_slots) < duration:
                continue

            for i in range(len(shift_slots) - duration + 1):
                candidate = shift_slots[i : i + duration]
                # Check contiguity: period_number must be strictly consecutive
                is_contiguous = True
                for j in range(len(candidate) - 1):
                    if candidate[j + 1].period_number != candidate[j].period_number + 1:
                        is_contiguous = False
                        break

                if is_contiguous:
                    sequences.append(candidate)

        return sequences
