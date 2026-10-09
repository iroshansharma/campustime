import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from apps.academics.models import College, Department, Semester, Section, Shift, AcademicYear
from apps.faculty.models import Faculty
from apps.accounts.models import StudentProfile

User = get_user_model()


@pytest.mark.django_db
class TestAuthenticationAPI:
    @pytest.fixture
    def api_client(self):
        return APIClient()

    @pytest.fixture
    def setup_users(self):
        # Admin user
        admin = User.objects.create_user(
            username='admin_api_user',
            email='admin_api@test.com',
            password='AdminPassword123!',
            role=User.Role.ADMIN
        )

        # College and Dept for Faculty & Student
        college = College.objects.create(name='API Test College', code='ATC')
        dept = Department.objects.create(college=college, name='CS', code='CS')
        ay = AcademicYear.objects.create(college=college, name='2024-2025', start_date='2024-08-01', end_date='2025-05-31')
        shift = Shift.objects.create(college=college, name='S1', code='S1', start_time='08:30:00', end_time='14:30:00')
        sem = Semester.objects.create(academic_year=ay, department=dept, semester_number=1, shift=shift)
        sec = Section.objects.create(semester=sem, name='A', student_count=60)

        # Faculty user
        faculty_user = User.objects.create_user(
            username='faculty_api_user',
            email='faculty_api@test.com',
            password='FacultyPassword123!',
            role=User.Role.FACULTY
        )
        faculty_profile = Faculty.objects.create(
            user=faculty_user,
            employee_id='EMP999',
            department=dept,
            designation=Faculty.Designation.PROFESSOR
        )

        # Student user
        student_user = User.objects.create_user(
            username='student_api_user',
            email='student_api@test.com',
            password='StudentPassword123!',
            role=User.Role.STUDENT
        )
        student_profile = StudentProfile.objects.create(
            user=student_user,
            enrollment_number='ENR999',
            department=dept,
            section=sec
        )

        return {
            'admin': admin,
            'faculty': faculty_user,
            'student': student_user,
        }

    def test_login_success_admin(self, api_client, setup_users):
        response = api_client.post('/api/v1/auth/token/', {
            'username': 'admin_api_user',
            'password': 'AdminPassword123!'
        })
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert 'access' in data
        assert 'refresh' in data
        assert 'user' in data
        assert data['user']['username'] == 'admin_api_user'
        assert data['user']['role'] == 'ADMIN'
        assert data['user']['faculty_profile'] is None
        assert data['user']['student_profile'] is None

    def test_login_success_faculty(self, api_client, setup_users):
        response = api_client.post('/api/v1/auth/token/', {
            'username': 'faculty_api_user',
            'password': 'FacultyPassword123!'
        })
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['user']['role'] == 'FACULTY'
        assert data['user']['faculty_profile']['employee_id'] == 'EMP999'
        assert data['user']['faculty_profile']['department_code'] == 'CS'

    def test_login_success_student(self, api_client, setup_users):
        response = api_client.post('/api/v1/auth/token/', {
            'username': 'student_api_user',
            'password': 'StudentPassword123!'
        })
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['user']['role'] == 'STUDENT'
        assert data['user']['student_profile']['enrollment_number'] == 'ENR999'

    def test_login_invalid_credentials(self, api_client, setup_users):
        response = api_client.post('/api/v1/auth/token/', {
            'username': 'admin_api_user',
            'password': 'WrongPassword!'
        })
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_token_refresh(self, api_client, setup_users):
        login_resp = api_client.post('/api/v1/auth/token/', {
            'username': 'admin_api_user',
            'password': 'AdminPassword123!'
        })
        refresh_token = login_resp.json()['refresh']

        refresh_resp = api_client.post('/api/v1/auth/token/refresh/', {
            'refresh': refresh_token
        })
        assert refresh_resp.status_code == status.HTTP_200_OK
        assert 'access' in refresh_resp.json()

    def test_token_refresh_invalid(self, api_client):
        response = api_client.post('/api/v1/auth/token/refresh/', {
            'refresh': 'invalid.token.here'
        })
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_auth_me_authenticated(self, api_client, setup_users):
        login_resp = api_client.post('/api/v1/auth/token/', {
            'username': 'faculty_api_user',
            'password': 'FacultyPassword123!'
        })
        token = login_resp.json()['access']

        api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        response = api_client.get('/api/v1/auth/me/')
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data['username'] == 'faculty_api_user'
        assert data['role'] == 'FACULTY'
        assert data['faculty_profile']['employee_id'] == 'EMP999'

    def test_auth_me_unauthenticated(self, api_client):
        response = api_client.get('/api/v1/auth/me/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_auth_me_invalid_token(self, api_client):
        api_client.credentials(HTTP_AUTHORIZATION='Bearer garbage_token_xyz')
        response = api_client.get('/api/v1/auth/me/')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
