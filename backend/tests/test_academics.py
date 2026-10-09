from datetime import date, time
import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from apps.academics.models import (
    College, AcademicYear, Shift, PeriodSlot,
    Department, Semester, Section, Subject
)


@pytest.mark.django_db
class TestAcademicsModels:
    @pytest.fixture
    def setup_college(self):
        college = College.objects.create(name='Tech Institute', code='TECH01')
        shift = Shift.objects.create(
            college=college, name='Shift I', code='SH1',
            start_time=time(8, 30), end_time=time(14, 30)
        )
        dept = Department.objects.create(college=college, name='Computer Eng', code='CE')
        ay = AcademicYear.objects.create(
            college=college, name='2024-2025',
            start_date=date(2024, 8, 1), end_date=date(2025, 5, 31)
        )
        return {
            'college': college,
            'shift': shift,
            'dept': dept,
            'ay': ay
        }

    def test_academic_year_dates_validation(self, setup_college):
        college = setup_college['college']
        # End date before start date should violate check constraint or clean()
        invalid_ay = AcademicYear(
            college=college,
            name='Invalid Year',
            start_date=date(2025, 6, 1),
            end_date=date(2024, 6, 1)
        )
        with pytest.raises(ValidationError):
            invalid_ay.clean()

    def test_shift_times_validation(self, setup_college):
        college = setup_college['college']
        invalid_shift = Shift(
            college=college,
            name='Invalid Shift',
            code='INV',
            start_time=time(15, 0),
            end_time=time(9, 0)
        )
        with pytest.raises(ValidationError):
            invalid_shift.clean()

    def test_period_slot_uniqueness(self, setup_college):
        shift = setup_college['shift']
        PeriodSlot.objects.create(
            shift=shift,
            day_of_week='MON',
            period_number=1,
            start_time=time(8, 30),
            end_time=time(9, 25)
        )
        # Duplicate period number on same shift and day must raise IntegrityError
        with pytest.raises(IntegrityError):
            PeriodSlot.objects.create(
                shift=shift,
                day_of_week='MON',
                period_number=1,
                start_time=time(8, 30),
                end_time=time(9, 25)
            )

    def test_subject_consecutive_slots_rules(self, setup_college):
        dept = setup_college['dept']
        # Consecutive slots cannot exceed weekly periods
        invalid_subject = Subject(
            department=dept,
            code='INV101',
            name='Invalid Subject',
            weekly_periods=2,
            consecutive_slots=3
        )
        with pytest.raises(ValidationError):
            invalid_subject.clean()

        # Weekly periods must be divisible by consecutive slots
        indivisible_subject = Subject(
            department=dept,
            code='INV102',
            name='Indivisible Subject',
            weekly_periods=5,
            consecutive_slots=2
        )
        with pytest.raises(ValidationError):
            indivisible_subject.clean()

    def test_section_unique_per_semester(self, setup_college):
        ay = setup_college['ay']
        dept = setup_college['dept']
        shift = setup_college['shift']
        sem = Semester.objects.create(
            academic_year=ay, department=dept, semester_number=3, shift=shift
        )
        Section.objects.create(semester=sem, name='A', student_count=60)
        with pytest.raises(IntegrityError):
            Section.objects.create(semester=sem, name='A', student_count=55)
