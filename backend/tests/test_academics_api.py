from datetime import date, time
import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from apps.academics.models import (
    College, AcademicYear, Shift, PeriodSlot,
    Department, Semester, Section, Subject
)

User = get_user_model()


@pytest.mark.django_db
class TestAcademicsAPI:
    @pytest.fixture
    def setup_data(self):
        client = APIClient()

        # Admin user
        admin = User.objects.create_user(
            username='admin_acad',
            email='admin_acad@test.com',
            password='AdminPassword123!',
            role=User.Role.ADMIN
        )

        # Faculty user
        faculty = User.objects.create_user(
            username='faculty_acad',
            email='faculty_acad@test.com',
            password='FacultyPassword123!',
            role=User.Role.FACULTY
        )

        # Student user
        student = User.objects.create_user(
            username='student_acad',
            email='student_acad@test.com',
            password='StudentPassword123!',
            role=User.Role.STUDENT
        )

        # Primary College
        college1 = College.objects.create(name='College One', code='COL1')
        college2 = College.objects.create(name='College Two', code='COL2')

        ay1 = AcademicYear.objects.create(
            college=college1, name='2024-2025',
            start_date=date(2024, 8, 1), end_date=date(2025, 5, 31),
            is_current=True
        )
        ay2 = AcademicYear.objects.create(
            college=college2, name='2024-2025-C2',
            start_date=date(2024, 8, 1), end_date=date(2025, 5, 31),
            is_current=False
        )

        shift1 = Shift.objects.create(
            college=college1, name='Morning Shift', code='MS1',
            start_time=time(8, 30), end_time=time(14, 30)
        )
        shift2 = Shift.objects.create(
            college=college2, name='C2 Shift', code='C2S1',
            start_time=time(9, 0), end_time=time(15, 0)
        )

        dept1 = Department.objects.create(college=college1, name='CSE', code='CSE')
        dept2 = Department.objects.create(college=college2, name='ECE', code='ECE')

        sem1 = Semester.objects.create(
            academic_year=ay1, department=dept1, semester_number=5, shift=shift1
        )
        sec1 = Section.objects.create(semester=sem1, name='A', student_count=60)

        sub1 = Subject.objects.create(
            department=dept1, code='CS501', name='Database Management Systems',
            subject_type=Subject.SubjectType.THEORY,
            weekly_periods=4, consecutive_slots=1
        )

        slot1 = PeriodSlot.objects.create(
            shift=shift1, day_of_week='MON', period_number=1,
            start_time=time(8, 30), end_time=time(9, 25)
        )

        return {
            'client': client,
            'admin': admin,
            'faculty': faculty,
            'student': student,
            'college1': college1,
            'college2': college2,
            'ay1': ay1,
            'ay2': ay2,
            'shift1': shift1,
            'shift2': shift2,
            'dept1': dept1,
            'dept2': dept2,
            'sem1': sem1,
            'sec1': sec1,
            'sub1': sub1,
            'slot1': slot1,
        }

    def authenticate_as(self, client, user):
        client.force_authenticate(user=user)

    def test_unauthenticated_requests_fail(self, setup_data):
        client = setup_data['client']
        # GET request unauthenticated
        resp = client.get('/api/v1/academics/colleges/')
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

        # POST request unauthenticated
        resp = client.post('/api/v1/academics/colleges/', {'name': 'X', 'code': 'X'})
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_faculty_read_only_access(self, setup_data):
        client = setup_data['client']
        self.authenticate_as(client, setup_data['faculty'])

        # Read operation succeeds
        get_resp = client.get('/api/v1/academics/colleges/')
        assert get_resp.status_code == status.HTTP_200_OK

        # Write operation forbidden
        post_resp = client.post('/api/v1/academics/colleges/', {
            'name': 'Unauthorized College', 'code': 'UC'
        })
        assert post_resp.status_code == status.HTTP_403_FORBIDDEN

    def test_student_read_only_access(self, setup_data):
        client = setup_data['client']
        self.authenticate_as(client, setup_data['student'])

        get_resp = client.get('/api/v1/academics/subjects/')
        assert get_resp.status_code == status.HTTP_200_OK

        post_resp = client.post('/api/v1/academics/subjects/', {
            'department': setup_data['dept1'].id,
            'code': 'CS999', 'name': 'Hacking',
            'weekly_periods': 4, 'consecutive_slots': 1
        })
        assert post_resp.status_code == status.HTTP_403_FORBIDDEN

    def test_admin_crud_college(self, setup_data):
        client = setup_data['client']
        self.authenticate_as(client, setup_data['admin'])

        # Create
        create_resp = client.post('/api/v1/academics/colleges/', {
            'name': 'New Tech College',
            'code': 'NTC',
            'email': 'contact@ntc.edu'
        })
        assert create_resp.status_code == status.HTTP_201_CREATED
        new_id = create_resp.json()['id']

        # Retrieve
        get_resp = client.get(f'/api/v1/academics/colleges/{new_id}/')
        assert get_resp.status_code == status.HTTP_200_OK
        assert get_resp.json()['code'] == 'NTC'

        # Update
        patch_resp = client.patch(f'/api/v1/academics/colleges/{new_id}/', {
            'name': 'Updated Tech College'
        })
        assert patch_resp.status_code == status.HTTP_200_OK
        assert patch_resp.json()['name'] == 'Updated Tech College'

        # Delete
        delete_resp = client.delete(f'/api/v1/academics/colleges/{new_id}/')
        assert delete_resp.status_code == status.HTTP_204_NO_CONTENT

    def test_admin_create_department_and_subject(self, setup_data):
        client = setup_data['client']
        self.authenticate_as(client, setup_data['admin'])

        dept_resp = client.post('/api/v1/academics/departments/', {
            'college': setup_data['college1'].id,
            'name': 'Information Technology',
            'code': 'IT'
        })
        assert dept_resp.status_code == status.HTTP_201_CREATED
        it_dept_id = dept_resp.json()['id']

        sub_resp = client.post('/api/v1/academics/subjects/', {
            'department': it_dept_id,
            'code': 'IT-301',
            'name': 'Computer Networks',
            'subject_type': 'THEORY',
            'credits': 4,
            'weekly_periods': 4,
            'consecutive_slots': 1
        })
        assert sub_resp.status_code == status.HTTP_201_CREATED
        assert sub_resp.json()['code'] == 'IT-301'

    def test_cross_college_semester_validation(self, setup_data):
        client = setup_data['client']
        self.authenticate_as(client, setup_data['admin'])

        # Attempt to create semester with Academic Year from College 1, but Department from College 2
        bad_resp = client.post('/api/v1/academics/semesters/', {
            'academic_year': setup_data['ay1'].id,       # College 1
            'department': setup_data['dept2'].id,         # College 2!
            'shift': setup_data['shift1'].id,            # College 1
            'semester_number': 1
        })
        assert bad_resp.status_code == status.HTTP_400_BAD_REQUEST
        err = str(bad_resp.json())
        assert 'does not belong to College' in err

    def test_date_range_validation_academic_year(self, setup_data):
        client = setup_data['client']
        self.authenticate_as(client, setup_data['admin'])

        # Start date after end date
        bad_resp = client.post('/api/v1/academics/academic-years/', {
            'college': setup_data['college1'].id,
            'name': 'Invalid Cycle',
            'start_date': '2025-06-01',
            'end_date': '2024-06-01'
        })
        assert bad_resp.status_code == status.HTTP_400_BAD_REQUEST
        assert 'end_date' in bad_resp.json()

    def test_time_range_validation_shift(self, setup_data):
        client = setup_data['client']
        self.authenticate_as(client, setup_data['admin'])

        # Start time after end time
        bad_resp = client.post('/api/v1/academics/shifts/', {
            'college': setup_data['college1'].id,
            'name': 'Invalid Shift',
            'code': 'INV1',
            'start_time': '16:00:00',
            'end_time': '08:00:00'
        })
        assert bad_resp.status_code == status.HTTP_400_BAD_REQUEST
        assert 'end_time' in bad_resp.json()

    def test_period_slot_validation(self, setup_data):
        client = setup_data['client']
        self.authenticate_as(client, setup_data['admin'])

        bad_resp = client.post('/api/v1/academics/period-slots/', {
            'shift': setup_data['shift1'].id,
            'day_of_week': 'TUE',
            'period_number': 1,
            'start_time': '10:00:00',
            'end_time': '09:00:00'
        })
        assert bad_resp.status_code == status.HTTP_400_BAD_REQUEST
        assert 'end_time' in bad_resp.json()

    def test_subject_block_divisibility_validation(self, setup_data):
        client = setup_data['client']
        self.authenticate_as(client, setup_data['admin'])

        # Weekly periods = 5, consecutive slots = 2 -> not divisible
        bad_resp = client.post('/api/v1/academics/subjects/', {
            'department': setup_data['dept1'].id,
            'code': 'CS-INV',
            'name': 'Non divisible lab',
            'weekly_periods': 5,
            'consecutive_slots': 2
        })
        assert bad_resp.status_code == status.HTTP_400_BAD_REQUEST
        assert 'consecutive_slots' in bad_resp.json()

    def test_section_headcount_validation(self, setup_data):
        client = setup_data['client']
        self.authenticate_as(client, setup_data['admin'])

        bad_resp = client.post('/api/v1/academics/sections/', {
            'semester': setup_data['sem1'].id,
            'name': 'Z',
            'student_count': 0
        })
        assert bad_resp.status_code == status.HTTP_400_BAD_REQUEST
        assert 'student_count' in bad_resp.json()

    def test_viewset_filtering(self, setup_data):
        client = setup_data['client']
        self.authenticate_as(client, setup_data['admin'])

        # Filter AcademicYears by is_current=true
        resp = client.get('/api/v1/academics/academic-years/?is_current=true')
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        results = data['results'] if 'results' in data else data
        assert len(results) == 1
        assert results[0]['id'] == setup_data['ay1'].id

        # Filter PeriodSlots by day_of_week=MON
        resp = client.get(f'/api/v1/academics/period-slots/?shift={setup_data["shift1"].id}&day_of_week=MON')
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        results = data['results'] if 'results' in data else data
        assert len(results) == 1
        assert results[0]['id'] == setup_data['slot1'].id

    def test_openapi_schema_endpoint(self, setup_data):
        client = setup_data['client']
        # Schema endpoint is accessible in JSON format
        resp = client.get('/api/v1/schema/?format=json')
        assert resp.status_code == status.HTTP_200_OK
        assert 'openapi' in resp.json()
