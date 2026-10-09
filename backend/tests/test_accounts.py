import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError
from apps.accounts.models import StudentProfile
from apps.academics.models import College, AcademicYear, Shift, Department, Semester, Section

User = get_user_model()


@pytest.mark.django_db
class TestAccountsModels:
    def test_create_user_with_roles(self):
        admin_user = User.objects.create_user(
            username='admin_test',
            email='admin@test.com',
            password='Password123!',
            role=User.Role.ADMIN
        )
        assert admin_user.is_admin_role
        assert not admin_user.is_faculty_role
        assert not admin_user.is_student_role

        faculty_user = User.objects.create_user(
            username='faculty_test',
            email='faculty@test.com',
            password='Password123!',
            role=User.Role.FACULTY
        )
        assert faculty_user.is_faculty_role

        student_user = User.objects.create_user(
            username='student_test',
            email='student@test.com',
            password='Password123!',
            role=User.Role.STUDENT
        )
        assert student_user.is_student_role

    def test_unique_email_constraint(self):
        User.objects.create_user(
            username='user1',
            email='duplicate@test.com',
            password='Password123!'
        )
        with pytest.raises(IntegrityError):
            User.objects.create_user(
                username='user2',
                email='duplicate@test.com',
                password='Password123!'
            )

    def test_student_profile_association(self):
        user = User.objects.create_user(
            username='student_profile_test',
            email='student_profile@test.com',
            password='Password123!',
            role=User.Role.STUDENT
        )
        college = College.objects.create(name='Test College', code='TC01')
        dept = Department.objects.create(college=college, name='Test Dept', code='TD01')
        ay = AcademicYear.objects.create(
            college=college, name='2024-2025',
            start_date='2024-08-01', end_date='2025-05-31'
        )
        shift = Shift.objects.create(
            college=college, name='Shift 1', code='S1',
            start_time='08:30:00', end_time='14:30:00'
        )
        sem = Semester.objects.create(
            academic_year=ay, department=dept, semester_number=1, shift=shift
        )
        sec = Section.objects.create(semester=sem, name='A', student_count=50)

        profile = StudentProfile.objects.create(
            user=user,
            enrollment_number='ENR123456',
            department=dept,
            section=sec,
            batch_year=2024
        )
        assert profile.user == user
        assert user.student_profile == profile
        assert profile.section == sec
