from datetime import date, time
import pytest
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient

from apps.academics.models import (
    College, AcademicYear, Shift, PeriodSlot, WorkingDay,
    Department, Semester, Section, Subject
)
from apps.faculty.models import (
    Faculty, FacultySubjectQualification,
    FacultyAvailability, SectionSubjectAssignment
)
from apps.rooms.models import Room

User = get_user_model()


@pytest.mark.django_db
class TestFacultyAndAllocationAPI:
    @pytest.fixture
    def setup_data(self):
        client = APIClient()

        # Users
        admin_user = User.objects.create_user(
            username='admin_fac', email='admin_fac@test.com',
            password='AdminPassword123!', role=User.Role.ADMIN
        )
        faculty_user1 = User.objects.create_user(
            username='fac_user1', email='fac1@test.com',
            first_name='Alan', last_name='Turing',
            password='FacPassword123!', role=User.Role.FACULTY
        )
        faculty_user2 = User.objects.create_user(
            username='fac_user2', email='fac2@test.com',
            first_name='Grace', last_name='Hopper',
            password='FacPassword123!', role=User.Role.FACULTY
        )
        student_user = User.objects.create_user(
            username='student_fac', email='student_fac@test.com',
            password='StudentPassword123!', role=User.Role.STUDENT
        )

        # Colleges
        col1 = College.objects.create(name='Tech Institute 1', code='TI1')
        col2 = College.objects.create(name='Arts College 2', code='AC2')

        # Academic structure for Col1
        ay = AcademicYear.objects.create(
            college=col1, name='2024-2025',
            start_date=date(2024, 8, 1), end_date=date(2025, 5, 31),
            is_current=True
        )
        shift1 = Shift.objects.create(
            college=col1, name='Morning', code='M1',
            start_time=time(9, 0), end_time=time(17, 0)
        )
        # Period slots for Col1
        p1 = PeriodSlot.objects.create(
            shift=shift1, day_of_week=WorkingDay.Day.MON,
            period_number=1, start_time=time(9, 0), end_time=time(10, 0),
            is_break=False
        )
        p2 = PeriodSlot.objects.create(
            shift=shift1, day_of_week=WorkingDay.Day.MON,
            period_number=2, start_time=time(10, 0), end_time=time(11, 0),
            is_break=False
        )
        p_break = PeriodSlot.objects.create(
            shift=shift1, day_of_week=WorkingDay.Day.MON,
            period_number=3, start_time=time(11, 0), end_time=time(11, 30),
            is_break=True, break_label='Lunch Break'
        )

        # Shift & slot for Col2 (cross-college)
        shift2 = Shift.objects.create(
            college=col2, name='Evening', code='E2',
            start_time=time(12, 0), end_time=time(20, 0)
        )
        p_col2 = PeriodSlot.objects.create(
            shift=shift2, day_of_week=WorkingDay.Day.MON,
            period_number=1, start_time=time(12, 0), end_time=time(13, 0),
            is_break=False
        )

        dept_cs = Department.objects.create(college=col1, name='Computer Science', code='CSE')
        dept_arts = Department.objects.create(college=col2, name='Fine Arts', code='FA')

        sem1 = Semester.objects.create(
            academic_year=ay, department=dept_cs, shift=shift1,
            semester_number=1
        )
        sec_a = Section.objects.create(semester=sem1, name='CS-A')

        sub_algo = Subject.objects.create(
            department=dept_cs, name='Algorithms', code='CS101',
            weekly_periods=4, consecutive_slots=1,
            subject_type=Subject.SubjectType.THEORY
        )
        sub_os = Subject.objects.create(
            department=dept_cs, name='Operating Systems', code='CS102',
            weekly_periods=4, consecutive_slots=1,
            subject_type=Subject.SubjectType.THEORY
        )

        # Faculty profiles
        faculty1 = Faculty.objects.create(
            user=faculty_user1, employee_id='EMP001', department=dept_cs,
            designation=Faculty.Designation.PROFESSOR,
            max_weekly_periods=6, max_daily_periods=3
        )
        faculty2 = Faculty.objects.create(
            user=faculty_user2, employee_id='EMP002', department=dept_cs,
            designation=Faculty.Designation.ASSOCIATE_PROF,
            max_weekly_periods=10, max_daily_periods=4
        )

        # Room
        room1 = Room.objects.create(
            college=col1, department=dept_cs, name='Lab 101', code='L-101',
            room_type=Room.RoomType.LAB, capacity=40
        )

        return {
            'client': client,
            'admin_user': admin_user,
            'faculty_user1': faculty_user1,
            'faculty_user2': faculty_user2,
            'student_user': student_user,
            'col1': col1,
            'col2': col2,
            'dept_cs': dept_cs,
            'dept_arts': dept_arts,
            'sem1': sem1,
            'sec_a': sec_a,
            'sub_algo': sub_algo,
            'sub_os': sub_os,
            'faculty1': faculty1,
            'faculty2': faculty2,
            'p1': p1,
            'p2': p2,
            'p_break': p_break,
            'p_col2': p_col2,
            'room1': room1,
        }

    # 1. Faculty Profiles CRUD & Permissions
    def test_faculty_crud_admin(self, setup_data):
        client = setup_data['client']
        client.force_authenticate(user=setup_data['admin_user'])

        # List
        res = client.get('/api/v1/faculty/profiles/')
        assert res.status_code == status.HTTP_200_OK
        assert len(res.data['results']) == 2

        # Filter by department
        res = client.get(f"/api/v1/faculty/profiles/?department={setup_data['dept_cs'].id}")
        assert res.status_code == status.HTTP_200_OK
        assert len(res.data['results']) == 2

        # Retrieve detail
        fac1 = setup_data['faculty1']
        res = client.get(f'/api/v1/faculty/profiles/{fac1.id}/')
        assert res.status_code == status.HTTP_200_OK
        assert res.data['employee_id'] == 'EMP001'
        assert res.data['max_weekly_periods'] == 6

        # Update workload limit
        res = client.patch(f'/api/v1/faculty/profiles/{fac1.id}/', {'max_weekly_periods': 8})
        assert res.status_code == status.HTTP_200_OK
        assert res.data['max_weekly_periods'] == 8

    def test_faculty_permissions_student_denied(self, setup_data):
        client = setup_data['client']
        client.force_authenticate(user=setup_data['student_user'])

        # Students cannot access faculty profiles or admin configuration
        res = client.get('/api/v1/faculty/profiles/')
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_faculty_user_read_permitted(self, setup_data):
        client = setup_data['client']
        client.force_authenticate(user=setup_data['faculty_user1'])

        # Faculty can view profiles
        res = client.get('/api/v1/faculty/profiles/')
        assert res.status_code == status.HTTP_200_OK

        # But cannot create a new profile
        res = client.post('/api/v1/faculty/profiles/', {
            'employee_id': 'EMP999',
            'department': setup_data['dept_cs'].id
        })
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_faculty_workload_detail_endpoint(self, setup_data):
        client = setup_data['client']
        client.force_authenticate(user=setup_data['admin_user'])

        fac1 = setup_data['faculty1']
        res = client.get(f'/api/v1/faculty/profiles/{fac1.id}/workload/')
        assert res.status_code == status.HTTP_200_OK
        assert res.data['faculty_id'] == fac1.id
        assert res.data['current_weekly_load'] == 0
        assert res.data['remaining_weekly_capacity'] == 6

    # 2. Faculty Availability & Self Access
    def test_faculty_availability_self_management(self, setup_data):
        client = setup_data['client']
        faculty_user1 = setup_data['faculty_user1']
        faculty1 = setup_data['faculty1']
        faculty2 = setup_data['faculty2']
        p1 = setup_data['p1']
        p2 = setup_data['p2']

        # Faculty 1 sets their availability
        client.force_authenticate(user=faculty_user1)
        res = client.post('/api/v1/faculty/availability/', {
            'faculty': faculty1.id,
            'period_slot': p1.id,
            'is_available': True,
            'is_preferred': True,
            'reason': 'Preferred morning slot'
        })
        assert res.status_code == status.HTTP_201_CREATED
        avail_id = res.data['id']
        assert res.data['is_preferred'] is True

        # Faculty 1 can view their own availability
        res = client.get('/api/v1/faculty/availability/')
        assert res.status_code == status.HTTP_200_OK
        assert len(res.data['results']) == 1

        # Faculty 1 cannot modify Faculty 2's availability
        res = client.post('/api/v1/faculty/availability/', {
            'faculty': faculty2.id,
            'period_slot': p2.id,
            'is_available': False
        })
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_faculty_availability_student_forbidden(self, setup_data):
        client = setup_data['client']
        client.force_authenticate(user=setup_data['student_user'])

        res = client.get('/api/v1/faculty/availability/')
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_batch_availability_update(self, setup_data):
        client = setup_data['client']
        client.force_authenticate(user=setup_data['admin_user'])
        faculty1 = setup_data['faculty1']
        p1 = setup_data['p1']
        p2 = setup_data['p2']

        payload = {
            'faculty_id': faculty1.id,
            'slots': [
                {'period_slot_id': p1.id, 'is_available': True, 'is_preferred': True, 'reason': ''},
                {'period_slot_id': p2.id, 'is_available': False, 'is_preferred': False, 'reason': 'Lab meeting'}
            ]
        }
        res = client.post('/api/v1/faculty/availability/batch-update/', payload, format='json')
        assert res.status_code == status.HTTP_200_OK
        assert len(res.data) == 2

        # Verify in DB
        avail1 = FacultyAvailability.objects.get(faculty=faculty1, period_slot=p1)
        avail2 = FacultyAvailability.objects.get(faculty=faculty1, period_slot=p2)
        assert avail1.is_available is True
        assert avail1.is_preferred is True
        assert avail2.is_available is False
        assert avail2.reason == 'Lab meeting'

    def test_invalid_period_slot_break_rejected(self, setup_data):
        client = setup_data['client']
        client.force_authenticate(user=setup_data['admin_user'])
        faculty1 = setup_data['faculty1']
        p_break = setup_data['p_break']

        # Attempting to mark a break period as available should fail
        res = client.post('/api/v1/faculty/availability/', {
            'faculty': faculty1.id,
            'period_slot': p_break.id,
            'is_available': True
        })
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert 'is_available' in res.data

    def test_cross_college_period_slot_rejected(self, setup_data):
        client = setup_data['client']
        client.force_authenticate(user=setup_data['admin_user'])
        faculty1 = setup_data['faculty1']
        p_col2 = setup_data['p_col2']

        # Faculty 1 is from Col 1, p_col2 is from Col 2
        res = client.post('/api/v1/faculty/availability/', {
            'faculty': faculty1.id,
            'period_slot': p_col2.id,
            'is_available': True
        })
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert 'period_slot' in res.data

    # 3. Qualifications & Subject Allocation
    def test_qualification_enforcement(self, setup_data):
        client = setup_data['client']
        client.force_authenticate(user=setup_data['admin_user'])

        faculty1 = setup_data['faculty1']
        sub_algo = setup_data['sub_algo']
        sec_a = setup_data['sec_a']

        # Attempt to assign faculty1 without qualification -> should fail (HTTP 400)
        res = client.post('/api/v1/faculty/assignments/', {
            'section': sec_a.id,
            'subject': sub_algo.id,
            'faculty': faculty1.id,
            'is_primary': True
        })
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert 'faculty' in res.data

        # Now qualify faculty1 to teach Algorithms
        qual_res = client.post('/api/v1/faculty/qualifications/', {
            'faculty': faculty1.id,
            'subject': sub_algo.id,
            'preference_level': 5
        })
        assert qual_res.status_code == status.HTTP_201_CREATED

        # Assignment should now succeed
        assign_res = client.post('/api/v1/faculty/assignments/', {
            'section': sec_a.id,
            'subject': sub_algo.id,
            'faculty': faculty1.id,
            'is_primary': True
        })
        assert assign_res.status_code == status.HTTP_201_CREATED
        assert assign_res.data['subject_code'] == 'CS101'

    def test_workload_limit_enforced(self, setup_data):
        client = setup_data['client']
        client.force_authenticate(user=setup_data['admin_user'])

        faculty1 = setup_data['faculty1']  # max_weekly_periods = 6
        sub_algo = setup_data['sub_algo']  # weekly_periods = 4
        sub_os = setup_data['sub_os']      # weekly_periods = 4
        sec_a = setup_data['sec_a']

        # Qualify faculty1 for both subjects
        FacultySubjectQualification.objects.create(faculty=faculty1, subject=sub_algo)
        FacultySubjectQualification.objects.create(faculty=faculty1, subject=sub_os)

        # 1st assignment: 4 periods (4 <= 6) -> succeeds
        res1 = client.post('/api/v1/faculty/assignments/', {
            'section': sec_a.id,
            'subject': sub_algo.id,
            'faculty': faculty1.id
        })
        assert res1.status_code == status.HTTP_201_CREATED

        # 2nd assignment: +4 periods = 8 periods > 6 -> must fail
        res2 = client.post('/api/v1/faculty/assignments/', {
            'section': sec_a.id,
            'subject': sub_os.id,
            'faculty': faculty1.id
        })
        assert res2.status_code == status.HTTP_400_BAD_REQUEST
        assert 'faculty' in res2.data

    def test_cross_college_assignment_prevented(self, setup_data):
        client = setup_data['client']
        client.force_authenticate(user=setup_data['admin_user'])

        # Section in Col 2
        ay2 = AcademicYear.objects.create(
            college=setup_data['col2'], name='2024-2025-Arts',
            start_date=date(2024, 8, 1), end_date=date(2025, 5, 31)
        )
        shift2 = Shift.objects.filter(college=setup_data['col2']).first()
        sem_arts = Semester.objects.create(
            academic_year=ay2, department=setup_data['dept_arts'], shift=shift2,
            semester_number=1
        )
        sec_arts = Section.objects.create(semester=sem_arts, name='Arts-A')
        sub_painting = Subject.objects.create(
            department=setup_data['dept_arts'], name='Painting', code='ART101',
            weekly_periods=2
        )

        faculty1 = setup_data['faculty1']  # from Col 1
        # Attempt to qualify faculty1 for sub_painting -> rejected cross-college
        res_qual = client.post('/api/v1/faculty/qualifications/', {
            'faculty': faculty1.id,
            'subject': sub_painting.id
        })
        assert res_qual.status_code == status.HTTP_400_BAD_REQUEST

    # 4. Rooms API
    def test_rooms_api_list_and_filter(self, setup_data):
        client = setup_data['client']
        client.force_authenticate(user=setup_data['admin_user'])

        res = client.get('/api/v1/rooms/rooms/')
        assert res.status_code == status.HTTP_200_OK
        assert len(res.data['results']) >= 1

        # Filter by min_capacity
        res = client.get('/api/v1/rooms/rooms/?min_capacity=50')
        assert res.status_code == status.HTTP_200_OK
        assert len(res.data['results']) == 0

        res = client.get('/api/v1/rooms/rooms/?min_capacity=30')
        assert res.status_code == status.HTTP_200_OK
        assert len(res.data['results']) == 1
        assert res.data['results'][0]['code'] == 'L-101'
