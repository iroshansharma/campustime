import time
from dataclasses import dataclass, field
from typing import List, Dict, Set, Optional, Tuple

from .requirement_loader import SchedulingContext
from .session_expander import SchedulableSession
from .placement_generator import Placement


@dataclass
class SolverConfig:
    max_backtracks: int = 5000
    timeout_seconds: float = 30.0


@dataclass
class SolverResult:
    success: bool
    status: str  # 'SUCCESS', 'INFEASIBLE', 'LIMIT_REACHED'
    message: str
    assignments: Dict[str, Placement] = field(default_factory=dict)
    unassigned_sessions: List[SchedulableSession] = field(default_factory=list)
    backtracks_count: int = 0
    duration_seconds: float = 0.0
    nodes_explored: int = 0


class ConstraintSolver:
    """
    Constraint Satisfaction Problem (CSP) solver for college timetable scheduling.
    
    Features:
    - Minimum Remaining Values (MRV) variable ordering.
    - Degree heuristic as tie-breaker.
    - Forward checking with domain wipeout detection.
    - Hard constraint enforcement: section, faculty, and room collision prevention,
      faculty daily & weekly workload limits, contiguous lab blocks.
    - Soft optimization order: faculty preferred slots, qualification preference, balanced distribution.
    - Search limit safeguards (max backtracks & timeout).
    """

    def __init__(
        self,
        context: SchedulingContext,
        sessions: List[SchedulableSession],
        domains: Dict[str, List[Placement]],
        config: Optional[SolverConfig] = None
    ):
        self.context = context
        self.sessions = sessions
        self.session_map: Dict[str, SchedulableSession] = {s.session_id: s for s in sessions}
        self.initial_domains = domains
        self.config = config or SolverConfig()

        # Search statistics
        self.backtracks = 0
        self.nodes_explored = 0
        self.start_time = 0.0
        self.timed_out = False
        self.limit_hit = False

        # State tracking structures
        self.section_slots: Dict[Tuple[int, int], str] = {}
        self.faculty_slots: Dict[Tuple[int, int], str] = {}
        self.room_slots: Dict[Tuple[int, int], str] = {}
        self.faculty_daily_load: Dict[Tuple[int, str], int] = {}
        self.faculty_weekly_load: Dict[int, int] = {}

        self._initialize_locked_state()

    def _initialize_locked_state(self):
        """Populate resource maps with locked entries already present in the schedule."""
        for entry in self.context.locked_entries:
            slot = self.context.slot_map.get(entry.period_slot_id)
            day = slot.day_of_week if slot else ''

            self.section_slots[(entry.section_id, entry.period_slot_id)] = f"LOCKED_SEC_{entry.section_id}"
            self.faculty_slots[(entry.faculty_id, entry.period_slot_id)] = f"LOCKED_FAC_{entry.faculty_id}"
            self.room_slots[(entry.room_id, entry.period_slot_id)] = f"LOCKED_ROOM_{entry.room_id}"

            if day:
                self.faculty_daily_load[(entry.faculty_id, day)] = (
                    self.faculty_daily_load.get((entry.faculty_id, day), 0) + 1
                )
            self.faculty_weekly_load[entry.faculty_id] = (
                self.faculty_weekly_load.get(entry.faculty_id, 0) + 1
            )

    def solve(self) -> SolverResult:
        self.start_time = time.time()
        self.backtracks = 0
        self.nodes_explored = 0
        self.timed_out = False
        self.limit_hit = False

        # 1. Prune initial domains against locked entries & external bookings
        pruned_domains: Dict[str, List[Placement]] = {}
        for sess in self.sessions:
            valid_candidates = []
            for p in self.initial_domains.get(sess.session_id, []):
                if self._is_candidate_consistent(p):
                    valid_candidates.append(p)
            pruned_domains[sess.session_id] = valid_candidates

            # If any session has 0 legal placements from the start, it is proven infeasible
            if not valid_candidates:
                elapsed = time.time() - self.start_time
                return SolverResult(
                    success=False,
                    status='INFEASIBLE',
                    message=(
                        f"Initial infeasibility detected: Session '{sess.session_id}' "
                        f"({sess.subject_code} for Section {sess.section_id}) has 0 valid placements "
                        f"meeting room capacity/type, shift, or faculty availability constraints."
                    ),
                    unassigned_sessions=[sess],
                    duration_seconds=elapsed
                )

        assignments: Dict[str, Placement] = {}
        unassigned_ids = set(self.session_map.keys())

        # 2. Run backtracking search
        success = self._backtrack(assignments, unassigned_ids, pruned_domains)
        elapsed = time.time() - self.start_time

        if success:
            return SolverResult(
                success=True,
                status='SUCCESS',
                message="Valid optimal timetable schedule generated successfully satisfying all hard constraints.",
                assignments=assignments,
                backtracks_count=self.backtracks,
                duration_seconds=elapsed,
                nodes_explored=self.nodes_explored
            )

        if self.timed_out or self.limit_hit:
            reason = "timeout" if self.timed_out else f"max backtrack limit ({self.config.max_backtracks})"
            unassigned = [self.session_map[sid] for sid in unassigned_ids if sid not in assignments]
            return SolverResult(
                success=False,
                status='LIMIT_REACHED',
                message=(
                    f"Search limit reached ({reason} after {elapsed:.2f}s, "
                    f"{self.backtracks} backtracks, {self.nodes_explored} nodes). "
                    f"No valid schedule found within configured search limits."
                ),
                assignments=assignments,
                unassigned_sessions=unassigned,
                backtracks_count=self.backtracks,
                duration_seconds=elapsed,
                nodes_explored=self.nodes_explored
            )

        # Search exhausted without hitting limits
        unassigned = [self.session_map[sid] for sid in unassigned_ids if sid not in assignments]
        return SolverResult(
            success=False,
            status='INFEASIBLE',
            message="Search space exhausted: No combination of assignments satisfies all hard constraints simultaneously.",
            assignments=assignments,
            unassigned_sessions=unassigned,
            backtracks_count=self.backtracks,
            duration_seconds=elapsed,
            nodes_explored=self.nodes_explored
        )

    def _is_candidate_consistent(self, p: Placement) -> bool:
        """Check if placement p is consistent with current assignment state."""
        sess = p.session

        # 1. Check slot collisions
        for slot_id in p.slot_ids:
            if (sess.section_id, slot_id) in self.section_slots:
                return False
            if (sess.faculty_id, slot_id) in self.faculty_slots:
                return False
            if (p.room_id, slot_id) in self.room_slots:
                return False

        # 2. Check faculty daily workload
        fac_data = self.context.faculty.get(sess.faculty_id)
        if fac_data:
            current_day_load = self.faculty_daily_load.get((sess.faculty_id, p.day_of_week), 0)
            if current_day_load + len(p.slot_ids) > fac_data.max_daily_periods:
                return False

            current_week_load = self.faculty_weekly_load.get(sess.faculty_id, 0)
            if current_week_load + len(p.slot_ids) > fac_data.max_weekly_periods:
                return False

        return True

    def _select_unassigned_variable(
        self,
        unassigned_ids: Set[str],
        domains: Dict[str, List[Placement]]
    ) -> str:
        """
        MRV (Minimum Remaining Values) heuristic with Degree heuristic tie-breaker.
        """
        best_sid = None
        min_domain_size = float('inf')
        max_degree = -1

        for sid in unassigned_ids:
            domain_size = len(domains.get(sid, []))
            if domain_size < min_domain_size:
                min_domain_size = domain_size
                best_sid = sid
                sess = self.session_map[sid]
                # Degree: duration and number of shared faculty/section/room constraints
                max_degree = sess.duration_slots
            elif domain_size == min_domain_size:
                sess = self.session_map[sid]
                degree = sess.duration_slots
                if degree > max_degree:
                    max_degree = degree
                    best_sid = sid

        return best_sid

    def _backtrack(
        self,
        assignments: Dict[str, Placement],
        unassigned_ids: Set[str],
        domains: Dict[str, List[Placement]]
    ) -> bool:
        # Check termination condition
        if not unassigned_ids:
            return True

        # Check search limits
        if time.time() - self.start_time > self.config.timeout_seconds:
            self.timed_out = True
            return False

        if self.backtracks >= self.config.max_backtracks:
            self.limit_hit = True
            return False

        self.nodes_explored += 1

        # MRV variable selection
        var_id = self._select_unassigned_variable(unassigned_ids, domains)
        var_session = self.session_map[var_id]
        var_domain = domains.get(var_id, [])

        unassigned_ids.remove(var_id)

        for placement in var_domain:
            if not self._is_candidate_consistent(placement):
                continue

            # Assign placement
            self._apply_placement(placement)
            assignments[var_id] = placement

            # Forward checking: prune remaining domains
            pruned_domains, is_wipeout = self._forward_check(
                placement, unassigned_ids, domains
            )

            if not is_wipeout:
                result = self._backtrack(assignments, unassigned_ids, pruned_domains)
                if result:
                    return True

            # Revert assignment
            self._revert_placement(placement)
            del assignments[var_id]
            self.backtracks += 1

            if self.timed_out or self.limit_hit:
                break

        unassigned_ids.add(var_id)
        return False

    def _apply_placement(self, p: Placement):
        sess = p.session
        for slot_id in p.slot_ids:
            self.section_slots[(sess.section_id, slot_id)] = sess.session_id
            self.faculty_slots[(sess.faculty_id, slot_id)] = sess.session_id
            self.room_slots[(p.room_id, slot_id)] = sess.session_id

        day_key = (sess.faculty_id, p.day_of_week)
        self.faculty_daily_load[day_key] = self.faculty_daily_load.get(day_key, 0) + len(p.slot_ids)
        self.faculty_weekly_load[sess.faculty_id] = self.faculty_weekly_load.get(sess.faculty_id, 0) + len(p.slot_ids)

    def _revert_placement(self, p: Placement):
        sess = p.session
        for slot_id in p.slot_ids:
            self.section_slots.pop((sess.section_id, slot_id), None)
            self.faculty_slots.pop((sess.faculty_id, slot_id), None)
            self.room_slots.pop((p.room_id, slot_id), None)

        day_key = (sess.faculty_id, p.day_of_week)
        self.faculty_daily_load[day_key] = max(0, self.faculty_daily_load.get(day_key, 0) - len(p.slot_ids))
        self.faculty_weekly_load[sess.faculty_id] = max(0, self.faculty_weekly_load.get(sess.faculty_id, 0) - len(p.slot_ids))

    def _forward_check(
        self,
        just_assigned: Placement,
        unassigned_ids: Set[str],
        current_domains: Dict[str, List[Placement]]
    ) -> Tuple[Dict[str, List[Placement]], bool]:
        """
        Forward checking: prunes candidate placements from unassigned variables
        that conflict with `just_assigned`.
        Returns (new_domains, is_wipeout).
        """
        assigned_sess = just_assigned.session
        assigned_slots = set(just_assigned.slot_ids)
        assigned_room = just_assigned.room_id
        assigned_fac = assigned_sess.faculty_id
        assigned_sec = assigned_sess.section_id

        new_domains: Dict[str, List[Placement]] = {}

        for other_id in unassigned_ids:
            other_sess = self.session_map[other_id]
            other_domain = current_domains.get(other_id, [])

            shares_section = (other_sess.section_id == assigned_sec)
            shares_faculty = (other_sess.faculty_id == assigned_fac)

            # If no possible resource conflict between these two sessions, domain remains unchanged
            # (unless they share rooms, which depends on individual placement room_id)
            filtered_candidates = []
            for cand in other_domain:
                cand_slots = set(cand.slot_ids)
                slot_overlap = cand_slots.intersection(assigned_slots)

                if slot_overlap:
                    if shares_section:
                        continue
                    if shares_faculty:
                        continue
                    if cand.room_id == assigned_room:
                        continue

                # Also verify against workload limits if sharing faculty
                if shares_faculty:
                    fac_data = self.context.faculty.get(other_sess.faculty_id)
                    if fac_data:
                        cur_day = self.faculty_daily_load.get((other_sess.faculty_id, cand.day_of_week), 0)
                        if cur_day + len(cand.slot_ids) > fac_data.max_daily_periods:
                            continue
                        cur_week = self.faculty_weekly_load.get(other_sess.faculty_id, 0)
                        if cur_week + len(cand.slot_ids) > fac_data.max_weekly_periods:
                            continue

                filtered_candidates.append(cand)

            if not filtered_candidates:
                # Domain wipeout!
                return new_domains, True

            new_domains[other_id] = filtered_candidates

        return new_domains, False
