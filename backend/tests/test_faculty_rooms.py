from datetime import time
import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from apps.academics.models import (
    College, Shift, PeriodSlot, Department,
    Semester, Section, Subject, AcademicYear
)
from apps.faculty.models import (
    Faculty, FacultySubjectQualification,
    FacultyAvailability, SectionSubjectAssignment
)
from apps.rooms.models import Room, RoomAvailability

User = get_user_model()


@pytest.mark.django_db
class TestFacultyAndRoomsModels:
    @pytest.fixture
    def setup_data(self):
        college = College.objects.create(name='Eng College', code='EC01')
        dept = Department.objects.create(college=college, name='CSE', code='CSE')
        ay = AcademicYear.objects.create(
            college=college, name='2024-2025',
            start_date='2024-08-01', end_date='2025-05-31'
        )
        shift = Shift.objects.create(
            college=college, name='Shift I', code='S1',
            start_time=time(8, 30), end_time=time(14, 30)
        )
        sem = Semester.objects.create(
            academic_year=ay, department=dept, semester_number=5, shift=shift
        )
        sec = Section.objects.create(semester=sem, name='A', student_count=60)
        sub = Subject.objects.create(
            department=dept, code='CS501', name='DBMS',
            weekly_periods=4, consecutive_slots=1
        )
        slot = PeriodSlot.objects.create(
            shift=shift, day_of_week='MON', period_number=1,
            start_time=time(8, 30), end_time=time(9, 25)
        )
        user = User.objects.create_user(
            username='fac_user', email='fac@test.com', role=User.Role.FACULTY
        )
        fac = Faculty.objects.create(
            user=user, employee_id='EMP101', department=dept,
            max_weekly_periods=18, max_daily_periods=4
        )
        room = Room.objects.create(
            college=college, code='R101', name='Room 101',
            capacity=70, room_type=Room.RoomType.CLASSROOM
        )
        return {
            'college': college,
            'dept': dept,
            'shift': shift,
            'sem': sem,
            'sec': sec,
            'sub': sub,
            'slot': slot,
            'user': user,
            'fac': fac,
            'room': room,
        }

    def test_faculty_workload_validation(self, setup_data):
        fac = setup_data['fac']
        # max_daily cannot exceed max_weekly
        fac.max_daily_periods = 20
        fac.max_weekly_periods = 10
        with pytest.raises(ValidationError):
            fac.clean()

    def test_faculty_qualification_uniqueness(self, setup_data):
        fac = setup_data['fac']
        sub = setup_data['sub']
        FacultySubjectQualification.objects.create(
            faculty=fac, subject=sub, preference_level=4
        )
        with pytest.raises(IntegrityError):
            FacultySubjectQualification.objects.create(
                faculty=fac, subject=sub, preference_level=5
            )

    def test_faculty_availability_uniqueness(self, setup_data):
        fac = setup_data['fac']
        slot = setup_data['slot']
        FacultyAvailability.objects.create(
            faculty=fac, period_slot=slot, is_available=True
        )
        with pytest.raises(IntegrityError):
            FacultyAvailability.objects.create(
                faculty=fac, period_slot=slot, is_available=False
            )

    def test_section_subject_assignment_uniqueness(self, setup_data):
        sec = setup_data['sec']
        sub = setup_data['sub']
        fac = setup_data['fac']
        SectionSubjectAssignment.objects.create(
            section=sec, subject=sub, faculty=fac, is_primary=True
        )
        with pytest.raises(IntegrityError):
            SectionSubjectAssignment.objects.create(
                section=sec, subject=sub, faculty=fac, is_primary=False
            )

    def test_room_availability_uniqueness(self, setup_data):
        room = setup_data['room']
        slot = setup_data['slot']
        RoomAvailability.objects.create(
            room=room, period_slot=slot, is_available=True
        )
        with pytest.raises(IntegrityError):
            RoomAvailability.objects.create(
                room=room, period_slot=slot, is_available=False
            )
