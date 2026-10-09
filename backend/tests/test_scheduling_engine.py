import pytest
from datetime import date, time
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import User
from apps.academics.models import (
    College, AcademicYear, Shift, Department, Semester, Section, Subject, PeriodSlot
)
from apps.faculty.models import (
    Faculty, FacultySubjectQualification, FacultyAvailability, SectionSubjectAssignment
)
from apps.rooms.models import Room, RoomAvailability
from apps.timetables.models import Timetable, TimetableEntry
from apps.scheduling.services import (
    RequirementLoader,
    SchedulingScope,
    SessionExpander,
    PlacementGenerator,
    ConstraintSolver,
    SolverConfig,
    ScheduleValidator,
    ConflictDiagnosticsService,
    TimetablePersistenceService,
    TimetableGenerationEngine,
)


@pytest.fixture
def scheduling_fixture(db):
    """
    Sets up a realistic, deterministic test dataset:
    - 1 College, 1 AY, 1 Shift (Monday to Friday, 5 periods/day, period 3 is lunch break)
    - 1 Department (CSE), Semester 3
    - 2 Sections (CSE-A with 60 students, CSE-B with 60 students)
    - 2 Classrooms (C101: 70, C102: 70), 1 Lab (L201: 70)
    - 3 Faculty members
    - 3 Subjects: CS301 (Theory, 3 periods), CS302 (Theory, 3 periods), CS303 (Lab, 2 periods, consecutive=2)
    """
    college = College.objects.create(name="ADGIPS Tech", code="ADGIPS")
    ay = AcademicYear.objects.create(
        college=college,
        name="2024-25",
        start_date=date(2024, 8, 1),
        end_date=date(2025, 5, 31),
        is_current=True
    )
    shift = Shift.objects.create(
        college=college,
        name="Morning Shift",
        start_time=time(9, 0),
        end_time=time(15, 0)
    )
    dept = Department.objects.create(college=college, name="Computer Science", code="CSE")
    sem = Semester.objects.create(
        department=dept,
        academic_year=ay,
        shift=shift,
        semester_number=3
    )
    sec_a = Section.objects.create(semester=sem, name="CSE-3A", student_count=60)
    sec_b = Section.objects.create(semester=sem, name="CSE-3B", student_count=60)

    # Working days & period slots: 5 days (MON-FRI), 5 periods each
    # Period 3 is a 30-min break
    days = ['MON', 'TUE', 'WED', 'THU', 'FRI']
    slots = []
    for d in days:
        slots.append(PeriodSlot.objects.create(
            shift=shift, day_of_week=d, period_number=1,
            start_time=time(9, 0), end_time=time(10, 0), is_break=False
        ))
        slots.append(PeriodSlot.objects.create(
            shift=shift, day_of_week=d, period_number=2,
            start_time=time(10, 0), end_time=time(11, 0), is_break=False
        ))
        slots.append(PeriodSlot.objects.create(
            shift=shift, day_of_week=d, period_number=3,
            start_time=time(11, 0), end_time=time(11, 30), is_break=True, break_label="Lunch"
        ))
        slots.append(PeriodSlot.objects.create(
            shift=shift, day_of_week=d, period_number=4,
            start_time=time(11, 30), end_time=time(12, 30), is_break=False
        ))
        slots.append(PeriodSlot.objects.create(
            shift=shift, day_of_week=d, period_number=5,
            start_time=time(12, 30), end_time=time(13, 30), is_break=False
        ))

    # Rooms
    c101 = Room.objects.create(college=college, code="C101", name="Room 101", room_type=Room.RoomType.CLASSROOM, capacity=70)
    c102 = Room.objects.create(college=college, code="C102", name="Room 102", room_type=Room.RoomType.CLASSROOM, capacity=70)
    l201 = Room.objects.create(college=college, code="L201", name="Lab 201", room_type=Room.RoomType.LAB, capacity=70)

    # Faculty users
    u_alice = User.objects.create_user(username="alice", email="alice@adgips.edu", password="password123", role=User.Role.FACULTY, first_name="Alice", last_name="Smith")
    u_bob = User.objects.create_user(username="bob", email="bob@adgips.edu", password="password123", role=User.Role.FACULTY, first_name="Bob", last_name="Jones")
    u_charlie = User.objects.create_user(username="charlie", email="charlie@adgips.edu", password="password123", role=User.Role.FACULTY, first_name="Charlie", last_name="Brown")
    u_admin = User.objects.create_user(username="admin", email="admin@adgips.edu", password="password123", role=User.Role.ADMIN, first_name="Admin", last_name="User")

    f_alice = Faculty.objects.create(user=u_alice, department=dept, employee_id="FAC001", max_weekly_periods=12, max_daily_periods=3)
    f_bob = Faculty.objects.create(user=u_bob, department=dept, employee_id="FAC002", max_weekly_periods=12, max_daily_periods=3)
    f_charlie = Faculty.objects.create(user=u_charlie, department=dept, employee_id="FAC003", max_weekly_periods=12, max_daily_periods=3)

    # Subjects
    sub_ds = Subject.objects.create(department=dept, code="CS301", name="Data Structures", subject_type=Subject.SubjectType.THEORY, weekly_periods=3, consecutive_slots=1)
    sub_dbms = Subject.objects.create(department=dept, code="CS302", name="DBMS", subject_type=Subject.SubjectType.THEORY, weekly_periods=3, consecutive_slots=1)
    sub_dslab = Subject.objects.create(department=dept, code="CS303", name="DS Lab", subject_type=Subject.SubjectType.LAB, weekly_periods=2, consecutive_slots=2)

    # Qualifications
    FacultySubjectQualification.objects.create(faculty=f_alice, subject=sub_ds, preference_level=5)
    FacultySubjectQualification.objects.create(faculty=f_bob, subject=sub_dbms, preference_level=5)
    FacultySubjectQualification.objects.create(faculty=f_charlie, subject=sub_dslab, preference_level=5)

    # Section-Subject Assignments for Sec A
    SectionSubjectAssignment.objects.create(section=sec_a, subject=sub_ds, faculty=f_alice)
    SectionSubjectAssignment.objects.create(section=sec_a, subject=sub_dbms, faculty=f_bob)
    SectionSubjectAssignment.objects.create(section=sec_a, subject=sub_dslab, faculty=f_charlie)

    return {
        'college': college,
        'ay': ay,
        'shift': shift,
        'dept': dept,
        'sem': sem,
        'sec_a': sec_a,
        'sec_b': sec_b,
        'rooms': {'c101': c101, 'c102': c102, 'l201': l201},
        'faculty': {'alice': f_alice, 'bob': f_bob, 'charlie': f_charlie},
        'subjects': {'ds': sub_ds, 'dbms': sub_dbms, 'dslab': sub_dslab},
        'users': {'admin': u_admin, 'alice': u_alice, 'bob': u_bob, 'charlie': u_charlie},
        'slots': slots,
    }


@pytest.mark.django_db
class TestSchedulingEngine:

    def test_successful_timetable_generation(self, scheduling_fixture):
        """Verify solver generates, validates, and persists a valid schedule for Section A."""
        f = scheduling_fixture
        scope = SchedulingScope(
            academic_year_id=f['ay'].id,
            section_ids=[f['sec_a'].id]
        )

        result = TimetableGenerationEngine.generate(
            scope=scope,
            config=SolverConfig(max_backtracks=2000, timeout_seconds=15.0),
            user=f['users']['admin'],
            timetable_name="Test CSE-3A Timetable"
        )

        assert result.success is True
        assert result.status == 'SUCCESS'
        assert result.timetable_id is not None
        assert result.sessions_scheduled == 8  # 3 + 3 + 2 = 8 slots
        assert result.validation_report is not None
        assert result.validation_report.is_valid is True
        assert result.validation_report.hard_constraint_violations == 0

        # Verify DB entries
        tt = Timetable.objects.get(id=result.timetable_id)
        assert tt.status == Timetable.Status.DRAFT
        assert tt.entries.count() == 8

        # Verify zero entries in break slots
        assert not tt.entries.filter(period_slot__is_break=True).exists()

        # Verify lab entries are in LAB room
        lab_entries = tt.entries.filter(subject=f['subjects']['dslab'])
        assert lab_entries.count() == 2
        for le in lab_entries:
            assert le.room.room_type == Room.RoomType.LAB
            assert le.linked_session_id is not None

    def test_multi_section_shared_faculty_and_rooms(self, scheduling_fixture):
        """
        Verify multi-section scheduling without double-booking shared instructors and rooms.
        Sec A and Sec B both have classes taught by Alice in the same scope.
        """
        f = scheduling_fixture

        # Assign Alice to also teach DS for Sec B
        SectionSubjectAssignment.objects.create(
            section=f['sec_b'],
            subject=f['subjects']['ds'],
            faculty=f['faculty']['alice']
        )
        # Assign Bob to teach DBMS for Sec B
        SectionSubjectAssignment.objects.create(
            section=f['sec_b'],
            subject=f['subjects']['dbms'],
            faculty=f['faculty']['bob']
        )

        scope = SchedulingScope(
            academic_year_id=f['ay'].id,
            section_ids=[f['sec_a'].id, f['sec_b'].id]
        )

        result = TimetableGenerationEngine.generate(
            scope=scope,
            user=f['users']['admin'],
            timetable_name="Multi-Section Timetable"
        )

        assert result.success is True
        tt = Timetable.objects.get(id=result.timetable_id)

        # Ensure Alice never teaches Sec A and Sec B simultaneously
        alice_entries = tt.entries.filter(faculty=f['faculty']['alice'])
        alice_slots = [e.period_slot_id for e in alice_entries]
        assert len(alice_slots) == len(set(alice_slots)), "Alice has double-booked slots!"

        # Ensure no room is double-booked across sections
        for room in [f['rooms']['c101'], f['rooms']['c102']]:
            room_entries = tt.entries.filter(room=room)
            room_slots = [e.period_slot_id for e in room_entries]
            assert len(room_slots) == len(set(room_slots)), f"Room {room.code} double-booked!"

    def test_consecutive_lab_blocks(self, scheduling_fixture):
        """Verify lab sessions are scheduled contiguously without break splitting."""
        f = scheduling_fixture
        scope = SchedulingScope(
            academic_year_id=f['ay'].id,
            section_ids=[f['sec_a'].id]
        )

        result = TimetableGenerationEngine.generate(
            scope=scope,
            user=f['users']['admin']
        )
        assert result.success is True

        tt = Timetable.objects.get(id=result.timetable_id)
        lab_entries = list(tt.entries.filter(subject=f['subjects']['dslab']).order_by('period_slot__period_number'))
        assert len(lab_entries) == 2

        # Same day, consecutive period numbers
        e1, e2 = lab_entries[0], lab_entries[1]
        assert e1.day_of_week == e2.day_of_week
        assert e2.period_slot.period_number == e1.period_slot.period_number + 1
        assert e1.linked_session_id == e2.linked_session_id

    def test_room_capacity_and_type_compatibility(self, scheduling_fixture):
        """Verify section cannot be scheduled in smaller room or lab in classroom."""
        f = scheduling_fixture
        # Make all classrooms too small (cap 30 < Sec A 60)
        Room.objects.filter(room_type=Room.RoomType.CLASSROOM).update(capacity=30)

        scope = SchedulingScope(
            academic_year_id=f['ay'].id,
            section_ids=[f['sec_a'].id]
        )

        result = TimetableGenerationEngine.generate(
            scope=scope,
            user=f['users']['admin']
        )
        assert result.success is False
        assert result.status in ['INFEASIBLE', 'LIMIT_REACHED']
        # Check diagnostic bottlenecks identify room capacity
        assert any(b.category == 'ROOM_CAPACITY' for b in result.bottlenecks)

    def test_faculty_workload_limits(self, scheduling_fixture):
        """Verify solver respects faculty daily limit."""
        f = scheduling_fixture
        # Set Alice's daily limit to 1 period
        f['faculty']['alice'].max_daily_periods = 1
        f['faculty']['alice'].save()

        scope = SchedulingScope(
            academic_year_id=f['ay'].id,
            section_ids=[f['sec_a'].id]
        )

        result = TimetableGenerationEngine.generate(
            scope=scope,
            user=f['users']['admin']
        )
        assert result.success is True

        tt = Timetable.objects.get(id=result.timetable_id)
        alice_entries = tt.entries.filter(faculty=f['faculty']['alice'])
        days_seen = set()
        for e in alice_entries:
            assert e.day_of_week not in days_seen, "Alice assigned > 1 period on a single day!"
            days_seen.add(e.day_of_week)

    def test_locked_entries_preservation(self, scheduling_fixture):
        """Verify locked entries are preserved when regenerating a timetable."""
        f = scheduling_fixture
        scope = SchedulingScope(
            academic_year_id=f['ay'].id,
            section_ids=[f['sec_a'].id]
        )

        # First generation
        res1 = TimetableGenerationEngine.generate(
            scope=scope,
            user=f['users']['admin'],
            timetable_name="Draft v1"
        )
        assert res1.success is True
        tt = Timetable.objects.get(id=res1.timetable_id)

        # Lock the first entry
        first_entry = tt.entries.first()
        first_entry.is_locked = True
        first_entry.save()
        locked_id = first_entry.id
        locked_slot_id = first_entry.period_slot_id
        locked_subject_id = first_entry.subject_id

        # Regenerate for same timetable
        scope.timetable_id = tt.id
        res2 = TimetableGenerationEngine.generate(
            scope=scope,
            user=f['users']['admin']
        )
        assert res2.success is True

        tt.refresh_from_db()
        # Ensure locked entry still exists with same slot and subject
        preserved = tt.entries.get(id=locked_id)
        assert preserved.is_locked is True
        assert preserved.period_slot_id == locked_slot_id
        assert preserved.subject_id == locked_subject_id

    def test_independent_validator_detects_corrupted_schedule(self, scheduling_fixture):
        """Corrupt a schedule deliberately and verify ScheduleValidator catches every violation."""
        f = scheduling_fixture
        tt = Timetable.objects.create(
            academic_year=f['ay'],
            shift=f['shift'],
            name="Corrupted TT",
            status=Timetable.Status.DRAFT
        )

        break_slot = PeriodSlot.objects.filter(shift=f['shift'], is_break=True).first()
        normal_slot = PeriodSlot.objects.filter(shift=f['shift'], is_break=False).first()

        # 1. Class in break slot
        TimetableEntry.objects.create(
            timetable=tt,
            section=f['sec_a'],
            subject=f['subjects']['ds'],
            faculty=f['faculty']['alice'],
            room=f['rooms']['c101'],
            period_slot=break_slot,
            day_of_week=break_slot.day_of_week
        )

        # 2. Lab in regular classroom
        TimetableEntry.objects.create(
            timetable=tt,
            section=f['sec_a'],
            subject=f['subjects']['dslab'],
            faculty=f['faculty']['charlie'],
            room=f['rooms']['c101'],  # CLASSROOM not LAB
            period_slot=normal_slot,
            day_of_week=normal_slot.day_of_week
        )

        report = ScheduleValidator.validate_timetable_instance(tt.id)
        assert report.is_valid is False
        codes = [c.conflict_code for c in report.conflicts]
        assert "BREAK_SLOT_VIOLATION" in codes
        assert "ROOM_TYPE_MISMATCH" in codes

    def test_search_limit_handling(self, scheduling_fixture):
        """Verify solver reports search limit reached cleanly when max_backtracks is too low."""
        f = scheduling_fixture
        # Set max_backtracks=0 or 1 on a requirement
        scope = SchedulingScope(
            academic_year_id=f['ay'].id,
            section_ids=[f['sec_a'].id]
        )

        # Artificially constrain by giving solver config with 0 backtracks
        config = SolverConfig(max_backtracks=0, timeout_seconds=0.0001)
        result = TimetableGenerationEngine.generate(
            scope=scope,
            config=config,
            user=f['users']['admin']
        )
        assert result.success is False
        assert result.status == 'LIMIT_REACHED'
        assert "Search limit reached" in result.message

    def test_publish_validation_gate(self, scheduling_fixture):
        """Verify that publish endpoint rejects drafts with hard violations."""
        f = scheduling_fixture
        client = APIClient()
        client.force_authenticate(user=f['users']['admin'])

        tt = Timetable.objects.create(
            academic_year=f['ay'],
            shift=f['shift'],
            name="Invalid Draft",
            status=Timetable.Status.DRAFT
        )
        break_slot = PeriodSlot.objects.filter(shift=f['shift'], is_break=True).first()
        TimetableEntry.objects.create(
            timetable=tt,
            section=f['sec_a'],
            subject=f['subjects']['ds'],
            faculty=f['faculty']['alice'],
            room=f['rooms']['c101'],
            period_slot=break_slot,
            day_of_week=break_slot.day_of_week
        )

        # Attempt to publish invalid draft
        res = client.post(f"/api/v1/timetables/{tt.id}/publish/")
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "Cannot publish timetable with hard constraint violations" in res.data['detail']

        tt.refresh_from_db()
        assert tt.status == Timetable.Status.DRAFT

    def test_role_permissions_enforcement(self, scheduling_fixture):
        """Verify non-admin users cannot trigger generation or publish."""
        f = scheduling_fixture
        client = APIClient()
        client.force_authenticate(user=f['users']['alice'])  # Faculty user

        payload = {
            "academic_year_id": f['ay'].id,
            "section_ids": [f['sec_a'].id]
        }
        res = client.post("/api/v1/timetables/generate/", payload, format='json')
        assert res.status_code == status.HTTP_403_FORBIDDEN

        # Create student user
        u_student = User.objects.create_user(
            username="student1",
            email="student1@adgips.edu",
            password="password123",
            role=User.Role.STUDENT
        )
        client.force_authenticate(user=u_student)

        res = client.post("/api/v1/timetables/generate/", payload, format='json')
        assert res.status_code == status.HTTP_403_FORBIDDEN
