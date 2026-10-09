import time
from dataclasses import dataclass, field
from typing import List, Optional

from apps.timetables.models import Timetable

from .requirement_loader import RequirementLoader, SchedulingScope, SchedulingContext
from .session_expander import SessionExpander, SchedulableSession
from .placement_generator import PlacementGenerator, Placement
from .solver import ConstraintSolver, SolverConfig, SolverResult
from .validator import ScheduleValidator, ValidationReport
from .diagnostics import ConflictDiagnosticsService, DiagnosticBottleneck
from .persistence import TimetablePersistenceService


@dataclass
class GenerationResult:
    success: bool
    status: str  # 'SUCCESS', 'INFEASIBLE', 'LIMIT_REACHED', 'VALIDATION_FAILED'
    message: str
    timetable_id: Optional[int] = None
    timetable: Optional[Timetable] = None
    validation_report: Optional[ValidationReport] = None
    bottlenecks: List[DiagnosticBottleneck] = field(default_factory=list)
    sessions_required: int = 0
    sessions_scheduled: int = 0
    backtracks_count: int = 0
    duration_seconds: float = 0.0
    nodes_explored: int = 0

    def to_dict(self) -> dict:
        return {
            'success': self.success,
            'status': self.status,
            'message': self.message,
            'timetable_id': self.timetable_id,
            'sessions_required': self.sessions_required,
            'sessions_scheduled': self.sessions_scheduled,
            'backtracks_count': self.backtracks_count,
            'duration_seconds': round(self.duration_seconds, 3),
            'nodes_explored': self.nodes_explored,
            'validation_report': self.validation_report.to_dict() if self.validation_report else None,
            'bottlenecks': [
                {
                    'category': b.category,
                    'summary': b.summary,
                    'affected_entity': b.affected_entity,
                    'suggested_action': b.suggested_action,
                }
                for b in self.bottlenecks
            ]
        }


class TimetableGenerationEngine:
    """
    High-level facade orchestrating the complete scheduling pipeline:
    Loader -> Expander -> Placement Generator -> CSP Solver -> Validator -> Diagnostics -> Persistence.
    """

    @classmethod
    def generate(
        cls,
        scope: SchedulingScope,
        config: Optional[SolverConfig] = None,
        user=None,
        timetable_name: Optional[str] = None,
        notes: str = "",
        persist: bool = True
    ) -> GenerationResult:
        start_time = time.time()
        config = config or SolverConfig()

        # 1. Load context
        try:
            context = RequirementLoader.load_context(scope)
        except Exception as e:
            return GenerationResult(
                success=False,
                status='ERROR',
                message=f"Failed loading scheduling requirements: {str(e)}",
                bottlenecks=[
                    DiagnosticBottleneck(
                        category='SCOPE_EMPTY',
                        affected_entity='Scheduling Scope',
                        summary=str(e),
                        suggested_action='Ensure active sections, shifts, and academic offerings are configured for this scope under Academic Management.'
                    )
                ],
                duration_seconds=time.time() - start_time
            )

        # 2. Expand requirements to atomic schedulable sessions
        sessions = SessionExpander.expand_requirements(context)
        sessions_required = sum(s.duration_slots for s in sessions)

        if not sessions:
            return GenerationResult(
                success=False,
                status='ERROR',
                message="No curriculum teaching requirements found for the selected scope.",
                bottlenecks=[
                    DiagnosticBottleneck(
                        category='NO_REQUIREMENTS',
                        affected_entity='Teaching Allocations',
                        summary='The sections in scope have zero SectionSubjectRequirement or SectionSubjectAssignment entries.',
                        suggested_action='Add weekly period requirements and faculty allocations for these sections in Academic & Faculty Management.'
                    )
                ],
                duration_seconds=time.time() - start_time
            )

        # 3. Generate candidate domains
        initial_domains = PlacementGenerator.generate_candidate_domains(sessions, context)

        # 4. Run CSP solver
        solver = ConstraintSolver(context, sessions, initial_domains, config)
        solver_res = solver.solve()

        if not solver_res.success:
            # Diagnose bottlenecks
            bottlenecks = ConflictDiagnosticsService.analyze_generation_failure(
                context=context,
                unassigned_sessions=solver_res.unassigned_sessions,
                initial_domains=initial_domains
            )
            return GenerationResult(
                success=False,
                status=solver_res.status,
                message=solver_res.message,
                bottlenecks=bottlenecks,
                sessions_required=sessions_required,
                sessions_scheduled=sum(len(p.slot_ids) for p in solver_res.assignments.values()),
                backtracks_count=solver_res.backtracks_count,
                duration_seconds=solver_res.duration_seconds,
                nodes_explored=solver_res.nodes_explored
            )

        # 5. Independent validation
        assigned_placements = list(solver_res.assignments.values())
        validation_report = ScheduleValidator.validate_schedule(context, assigned_placements)

        if not validation_report.is_valid:
            bottlenecks = ConflictDiagnosticsService.analyze_generation_failure(
                context=context,
                unassigned_sessions=[],
                initial_domains=initial_domains,
                report=validation_report
            )
            return GenerationResult(
                success=False,
                status='VALIDATION_FAILED',
                message=f"Independent validation detected {validation_report.hard_constraint_violations} violation(s).",
                validation_report=validation_report,
                bottlenecks=bottlenecks,
                sessions_required=sessions_required,
                sessions_scheduled=validation_report.sessions_scheduled,
                backtracks_count=solver_res.backtracks_count,
                duration_seconds=solver_res.duration_seconds,
                nodes_explored=solver_res.nodes_explored
            )

        # 6. Persistence (if requested)
        timetable_instance = None
        if persist:
            try:
                timetable_instance = TimetablePersistenceService.persist_schedule(
                    context=context,
                    placements=assigned_placements,
                    user=user,
                    timetable_name=timetable_name,
                    notes=notes
                )
            except Exception as e:
                return GenerationResult(
                    success=False,
                    status='ERROR',
                    message=f"Database persistence failed: {str(e)}",
                    validation_report=validation_report,
                    sessions_required=sessions_required,
                    sessions_scheduled=validation_report.sessions_scheduled,
                    backtracks_count=solver_res.backtracks_count,
                    duration_seconds=time.time() - start_time,
                    nodes_explored=solver_res.nodes_explored
                )

        return GenerationResult(
            success=True,
            status='SUCCESS',
            message=solver_res.message,
            timetable_id=timetable_instance.id if timetable_instance else None,
            timetable=timetable_instance,
            validation_report=validation_report,
            sessions_required=sessions_required,
            sessions_scheduled=validation_report.sessions_scheduled,
            backtracks_count=solver_res.backtracks_count,
            duration_seconds=time.time() - start_time,
            nodes_explored=solver_res.nodes_explored
        )
