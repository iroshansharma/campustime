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

    def test_cors_preflight_allowed_origin(self, api_client):
        """Preflight OPTIONS request from production frontend must return Access-Control headers."""
        response = api_client.options(
            '/api/v1/auth/token/',
            HTTP_ORIGIN='https://campustime-pi.vercel.app',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST',
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS='content-type',
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.headers.get('Access-Control-Allow-Origin') == 'https://campustime-pi.vercel.app'
        allow_methods = response.headers.get('Access-Control-Allow-Methods', '')
        assert 'POST' in allow_methods

    def test_cors_preflight_vercel_preview_origin_allowed(self, api_client):
        """Dynamic preview deployments for this specific project must receive Access-Control headers."""
        preview_origin = 'https://campustime-cliby123-iroshansharmas-projects.vercel.app'
        response = api_client.options(
            '/api/v1/auth/token/',
            HTTP_ORIGIN=preview_origin,
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST',
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS='content-type',
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.headers.get('Access-Control-Allow-Origin') == preview_origin

    def test_cors_preflight_disallowed_origin(self, api_client):
        """Unauthorized origins must NOT receive Access-Control-Allow-Origin."""
        disallowed = [
            'https://malicious-site.example.com',
            'https://otherproject-iroshansharmas-projects.vercel.app',
            'https://campustime-pi.vercel.app.attacker.com',
            'https://attacker-campustime.vercel.app',
        ]
        for origin in disallowed:
            response = api_client.options(
                '/api/v1/auth/token/',
                HTTP_ORIGIN=origin,
                HTTP_ACCESS_CONTROL_REQUEST_METHOD='POST',
            )
            assert response.headers.get('Access-Control-Allow-Origin') is None, f"Origin {origin} should not be allowed"

    def test_health_check_endpoints(self, api_client):
        """Health endpoints must be read-only, lightweight, and return 200 OK."""
        res_root = api_client.get('/health/')
        assert res_root.status_code == status.HTTP_200_OK
        assert res_root.json()['status'] == 'healthy'

        res_api = api_client.get('/api/v1/health/')
        assert res_api.status_code == status.HTTP_200_OK
        data = res_api.json()
        assert data['status'] == 'healthy'
        assert data['database'] == 'healthy'
        assert data['tables_synced'] is True
        assert data['database_engine'] in ('sqlite', 'postgresql')

    def test_login_invalid_credentials_returns_401_not_500(self, api_client):
        """Invalid credentials must return 401 Unauthorized, never 500 Internal Server Error."""
        response = api_client.post('/api/v1/auth/token/', {
            'username': 'nonexistent_user_xyz',
            'password': 'WrongPassword123!',
        }, format='json')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert 'detail' in response.json()

    def test_login_empty_payload_returns_400(self, api_client):
        """Empty payload must return 400 Bad Request with field errors."""
        response = api_client.post('/api/v1/auth/token/', {}, format='json')
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        errors = response.json()
        assert 'username' in errors
        assert 'password' in errors

    def test_database_url_parsing_without_type_error(self):
        """Ensure DATABASE_URL config parses postgresql urls cleanly with CONN_MAX_AGE."""
        import environ
        test_env = environ.Env()
        sample_pg_url = 'postgresql://user:pass@ep-cool-fog-123456.us-east-2.aws.neon.tech/neondb?sslmode=require'
        test_env.ENVIRON['DATABASE_URL'] = sample_pg_url
        db_config = test_env.db_url('DATABASE_URL')
        db_config['CONN_MAX_AGE'] = 600
        assert db_config['ENGINE'] == 'django.db.backends.postgresql'
        assert db_config['NAME'] == 'neondb'
        assert db_config['CONN_MAX_AGE'] == 600

    def test_bootstrap_admin_command_updates_existing_user(self):
        """bootstrap_admin command safely resets password and ensures superuser flags."""
        from django.core.management import call_command
        from apps.accounts.models import User
        import io

        # Create user with initial password
        user = User.objects.create_user(
            username='test_bootstrap_user',
            email='bootstrap@test.com',
            password='OldPassword123!',
            role=User.Role.ADMIN
        )

        out = io.StringIO()
        call_command(
            'bootstrap_admin',
            username='test_bootstrap_user',
            password='NewSecurePassword456!',
            stdout=out
        )

        user.refresh_from_db()
        assert user.check_password('NewSecurePassword456!') is True
        assert user.is_staff is True
        assert user.is_superuser is True
        assert user.is_active is True

    def test_bootstrap_admin_command_skips_when_no_password(self):
        """bootstrap_admin command exits cleanly without error when no password is provided."""
        from django.core.management import call_command
        import io

        out = io.StringIO()
        call_command('bootstrap_admin', username='some_user', stdout=out)
        assert "Skipping admin bootstrap" in out.getvalue()

    def test_admin_bootstrap_endpoint_disabled_by_default(self, api_client):
        """Endpoint must return 404 Not Found when ADMIN_BOOTSTRAP_SECRET is not configured."""
        from django.conf import settings
        old_secret = getattr(settings, 'ADMIN_BOOTSTRAP_SECRET', '')
        try:
            settings.ADMIN_BOOTSTRAP_SECRET = ''
            response = api_client.post('/api/v1/auth/bootstrap-admin/', {
                'username': 'admin',
                'password': 'AnyPassword123!'
            }, format='json')
            assert response.status_code == status.HTTP_404_NOT_FOUND
        finally:
            settings.ADMIN_BOOTSTRAP_SECRET = old_secret

    def test_admin_bootstrap_endpoint_forbidden_with_invalid_key(self, api_client):
        """Endpoint must return 403 Forbidden when secret header does not match."""
        from django.conf import settings
        old_secret = getattr(settings, 'ADMIN_BOOTSTRAP_SECRET', '')
        try:
            settings.ADMIN_BOOTSTRAP_SECRET = 'super-secret-token-1234567890'
            response = api_client.post(
                '/api/v1/auth/bootstrap-admin/',
                {'username': 'admin', 'password': 'AnyPassword123!'},
                format='json',
                HTTP_X_ADMIN_BOOTSTRAP_KEY='wrong-token'
            )
            assert response.status_code == status.HTTP_403_FORBIDDEN
        finally:
            settings.ADMIN_BOOTSTRAP_SECRET = old_secret

    def test_admin_bootstrap_endpoint_success_and_subsequent_login(self, api_client):
        """Endpoint updates credentials with valid key and allows subsequent login."""
        from django.conf import settings
        old_secret = getattr(settings, 'ADMIN_BOOTSTRAP_SECRET', '')
        valid_secret = 'secure-bootstrap-key-998877665544332211'
        try:
            settings.ADMIN_BOOTSTRAP_SECRET = valid_secret
            # 1. Reset password via endpoint
            response = api_client.post(
                '/api/v1/auth/bootstrap-admin/',
                {
                    'username': 'endpoint_admin',
                    'password': 'EndpointResetPass123!',
                    'email': 'endpoint_admin@campustime.local'
                },
                format='json',
                HTTP_X_ADMIN_BOOTSTRAP_KEY=valid_secret
            )
            assert response.status_code == status.HTTP_200_OK
            assert response.json()['status'] == 'success'

            # 2. Verify subsequent login succeeds with the new password
            login_resp = api_client.post('/api/v1/auth/token/', {
                'username': 'endpoint_admin',
                'password': 'EndpointResetPass123!'
            }, format='json')
            assert login_resp.status_code == status.HTTP_200_OK
            assert 'access' in login_resp.json()
            assert login_resp.json()['user']['role'] == 'ADMIN'
        finally:
            settings.ADMIN_BOOTSTRAP_SECRET = old_secret

