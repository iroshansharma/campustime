from datetime import time
import uuid
import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from apps.academics.models import (
    College, Shift, PeriodSlot, Department,
    Semester, Section, Subject, AcademicYear
)
from apps.faculty.models import Faculty
from apps.rooms.models import Room
from apps.timetables.models import Timetable, TimetableEntry
from apps.audit.models import TimetableAuditLog

User = get_user_model()


@pytest.mark.django_db
class TestTimetablesModels:
    @pytest.fixture
    def setup_timetable_context(self):
        college = College.objects.create(name='Eng College', code='EC01')
        ay = AcademicYear.objects.create(
            college=college, name='2024-2025',
            start_date='2024-08-01', end_date='2025-05-31'
        )
        shift = Shift.objects.create(
            college=college, name='Shift I', code='S1',
            start_time=time(8, 30), end_time=time(14, 30)
        )
        dept = Department.objects.create(college=college, name='CSE', code='CSE')
        sem = Semester.objects.create(
            academic_year=ay, department=dept, semester_number=5, shift=shift
        )
        sec_a = Section.objects.create(semester=sem, name='A', student_count=60)
        sec_b = Section.objects.create(semester=sem, name='B', student_count=50)

        sub_theory = Subject.objects.create(
            department=dept, code='CS501', name='DBMS',
            subject_type=Subject.SubjectType.THEORY,
            weekly_periods=4, consecutive_slots=1
        )
        sub_lab = Subject.objects.create(
            department=dept, code='CS551', name='DBMS Lab',
            subject_type=Subject.SubjectType.LAB,
            weekly_periods=2, consecutive_slots=2
        )

        p1 = PeriodSlot.objects.create(
            shift=shift, day_of_week='MON', period_number=1,
            start_time=time(8, 30), end_time=time(9, 25), is_break=False
        )
        p2 = PeriodSlot.objects.create(
            shift=shift, day_of_week='MON', period_number=2,
            start_time=time(9, 25), end_time=time(10, 20), is_break=False
        )
        break_slot = PeriodSlot.objects.create(
            shift=shift, day_of_week='MON', period_number=4,
            start_time=time(11, 15), end_time=time(11, 45),
            is_break=True, break_label='Lunch Break'
        )

        room_lecture = Room.objects.create(
            college=college, code='LH101', name='Lecture Hall 101',
            capacity=70, room_type=Room.RoomType.CLASSROOM
        )
        room_lab = Room.objects.create(
            college=college, code='LAB301', name='DBMS Lab Room',
            capacity=65, room_type=Room.RoomType.LAB
        )

        user_fac1 = User.objects.create_user(username='fac1', email='f1@t.com', role=User.Role.FACULTY)
        user_fac2 = User.objects.create_user(username='fac2', email='f2@t.com', role=User.Role.FACULTY)

        fac1 = Faculty.objects.create(user=user_fac1, employee_id='F001', department=dept)
        fac2 = Faculty.objects.create(user=user_fac2, employee_id='F002', department=dept)

        tt = Timetable.objects.create(
            academic_year=ay, shift=shift, department=dept,
            semester=sem, name='CSE Sem 5 Schedule', status=Timetable.Status.DRAFT, version=1
        )

        return {
            'tt': tt,
            'sec_a': sec_a,
            'sec_b': sec_b,
            'sub_theory': sub_theory,
            'sub_lab': sub_lab,
            'p1': p1,
            'p2': p2,
            'break_slot': break_slot,
            'room_lecture': room_lecture,
            'room_lab': room_lab,
            'fac1': fac1,
            'fac2': fac2,
        }

    def test_database_constraint_prevents_room_double_booking(self, setup_timetable_context):
        ctx = setup_timetable_context
        # Schedule Section A in room LH101 at Period 1
        TimetableEntry.objects.create(
            timetable=ctx['tt'],
            section=ctx['sec_a'],
            subject=ctx['sub_theory'],
            faculty=ctx['fac1'],
            room=ctx['room_lecture'],
            period_slot=ctx['p1']
        )
        # Attempt to schedule Section B in the SAME room LH101 at Period 1
        with pytest.raises(IntegrityError):
            TimetableEntry.objects.create(
                timetable=ctx['tt'],
                section=ctx['sec_b'],
                subject=ctx['sub_theory'],
                faculty=ctx['fac2'],
                room=ctx['room_lecture'],
                period_slot=ctx['p1']
            )

    def test_database_constraint_prevents_faculty_double_booking(self, setup_timetable_context):
        ctx = setup_timetable_context
        # Schedule Faculty 1 with Section A at Period 1
        TimetableEntry.objects.create(
            timetable=ctx['tt'],
            section=ctx['sec_a'],
            subject=ctx['sub_theory'],
            faculty=ctx['fac1'],
            room=ctx['room_lecture'],
            period_slot=ctx['p1']
        )
        # Attempt to schedule Faculty 1 with Section B at the SAME period in a different room
        with pytest.raises(IntegrityError):
            TimetableEntry.objects.create(
                timetable=ctx['tt'],
                section=ctx['sec_b'],
                subject=ctx['sub_theory'],
                faculty=ctx['fac1'],
                room=ctx['room_lab'],
                period_slot=ctx['p1']
            )

    def test_database_constraint_prevents_section_double_booking(self, setup_timetable_context):
        ctx = setup_timetable_context
        # Schedule Section A at Period 1
        TimetableEntry.objects.create(
            timetable=ctx['tt'],
            section=ctx['sec_a'],
            subject=ctx['sub_theory'],
            faculty=ctx['fac1'],
            room=ctx['room_lecture'],
            period_slot=ctx['p1']
        )
        # Attempt to schedule Section A with another subject/faculty at Period 1
        with pytest.raises(IntegrityError):
            TimetableEntry.objects.create(
                timetable=ctx['tt'],
                section=ctx['sec_a'],
                subject=ctx['sub_lab'],
                faculty=ctx['fac2'],
                room=ctx['room_lab'],
                period_slot=ctx['p1']
            )

    def test_cannot_schedule_in_break_slot(self, setup_timetable_context):
        ctx = setup_timetable_context
        entry = TimetableEntry(
            timetable=ctx['tt'],
            section=ctx['sec_a'],
            subject=ctx['sub_theory'],
            faculty=ctx['fac1'],
            room=ctx['room_lecture'],
            period_slot=ctx['break_slot']
        )
        with pytest.raises(ValidationError) as exc_info:
            entry.clean()
        assert 'Cannot schedule a class during break slot' in str(exc_info.value)

    def test_room_capacity_validation(self, setup_timetable_context):
        ctx = setup_timetable_context
        # Small room with capacity 30 while section headcount is 60
        small_room = Room.objects.create(
            college=ctx['tt'].academic_year.college,
            code='SM01',
            name='Small Room',
            capacity=30,
            room_type=Room.RoomType.CLASSROOM
        )
        entry = TimetableEntry(
            timetable=ctx['tt'],
            section=ctx['sec_a'],
            subject=ctx['sub_theory'],
            faculty=ctx['fac1'],
            room=small_room,
            period_slot=ctx['p1']
        )
        with pytest.raises(ValidationError) as exc_info:
            entry.clean()
        assert 'capacity (30) is insufficient' in str(exc_info.value)

    def test_lab_subject_requires_lab_room(self, setup_timetable_context):
        ctx = setup_timetable_context
        # Schedule lab subject in a classroom
        entry = TimetableEntry(
            timetable=ctx['tt'],
            section=ctx['sec_a'],
            subject=ctx['sub_lab'],
            faculty=ctx['fac1'],
            room=ctx['room_lecture'],
            period_slot=ctx['p1']
        )
        with pytest.raises(ValidationError) as exc_info:
            entry.clean()
        assert 'must be scheduled in a LAB room' in str(exc_info.value)

    def test_consecutive_lab_session_linking_and_audit(self, setup_timetable_context):
        ctx = setup_timetable_context
        group_id = uuid.uuid4()
        entry1 = TimetableEntry.objects.create(
            timetable=ctx['tt'],
            section=ctx['sec_a'],
            subject=ctx['sub_lab'],
            faculty=ctx['fac1'],
            room=ctx['room_lab'],
            period_slot=ctx['p1'],
            linked_session_id=group_id
        )
        entry2 = TimetableEntry.objects.create(
            timetable=ctx['tt'],
            section=ctx['sec_a'],
            subject=ctx['sub_lab'],
            faculty=ctx['fac1'],
            room=ctx['room_lab'],
            period_slot=ctx['p2'],
            linked_session_id=group_id
        )
        assert entry1.linked_session_id == entry2.linked_session_id

        # Audit log creation
        audit_log = TimetableAuditLog.objects.create(
            timetable=ctx['tt'],
            action=TimetableAuditLog.Action.GENERATED,
            notes='Generated draft v1 schedule'
        )
        assert audit_log.pk is not None
        assert audit_log.action == TimetableAuditLog.Action.GENERATED
