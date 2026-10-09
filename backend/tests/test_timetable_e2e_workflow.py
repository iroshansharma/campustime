import pytest
from datetime import date, time
from rest_framework.test import APIClient
from rest_framework import status

from apps.accounts.models import User, StudentProfile
from apps.academics.models import (
    College, AcademicYear, Shift, Department, Semester, Section, Subject, PeriodSlot
)
from apps.faculty.models import (
    Faculty, FacultySubjectQualification, FacultyAvailability, SectionSubjectAssignment
)
from apps.rooms.models import Room
from apps.timetables.models import Timetable, TimetableEntry
from apps.audit.models import TimetableAuditLog
from apps.scheduling.services import TimetableGenerationEngine, SchedulingScope


@pytest.fixture
def e2e_fixture(db):
    """
    Sets up a complete university structure for end-to-end testing:
    - College, AY 2024-25, Morning Shift
    - 5 days (MON-FRI), 5 slots/day (Period 3 is Lunch)
    - Department CSE, Semester 3
    - Sections CSE-3A (headcount: 50)
    - Classroom C101 (cap: 60), Lab L201 (cap: 60)
    - Faculty Prof Alice, Prof Bob
    - Subjects: DS (Theory, 3 periods), DS Lab (Lab, 2 periods)
    - Student Alice Jr enrolled in CSE-3A
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
    sec_a = Section.objects.create(semester=sem, name="CSE-3A", student_count=50)

    # Slots
    slots = []
    days = ['MON', 'TUE', 'WED', 'THU', 'FRI']
    for d in days:
        slots.append(PeriodSlot.objects.create(shift=shift, day_of_week=d, period_number=1, start_time=time(9, 0), end_time=time(10, 0), is_break=False))
        slots.append(PeriodSlot.objects.create(shift=shift, day_of_week=d, period_number=2, start_time=time(10, 0), end_time=time(11, 0), is_break=False))
        slots.append(PeriodSlot.objects.create(shift=shift, day_of_week=d, period_number=3, start_time=time(11, 0), end_time=time(11, 30), is_break=True, break_label="Lunch Break"))
        slots.append(PeriodSlot.objects.create(shift=shift, day_of_week=d, period_number=4, start_time=time(11, 30), end_time=time(12, 30), is_break=False))
        slots.append(PeriodSlot.objects.create(shift=shift, day_of_week=d, period_number=5, start_time=time(12, 30), end_time=time(13, 30), is_break=False))

    # Rooms
    c101 = Room.objects.create(college=college, code="C101", name="Room 101", room_type=Room.RoomType.CLASSROOM, capacity=60)
    l201 = Room.objects.create(college=college, code="L201", name="Lab 201", room_type=Room.RoomType.LAB, capacity=60)

    # Faculty & Admin
    u_admin = User.objects.create_user(username="admin_e2e", email="admin_e2e@adgips.edu", password="pass", role=User.Role.ADMIN, first_name="Dean", last_name="Admin")
    u_alice = User.objects.create_user(username="prof_alice", email="alice_e2e@adgips.edu", password="pass", role=User.Role.FACULTY, first_name="Alice", last_name="Walker")
    u_bob = User.objects.create_user(username="prof_bob", email="bob_e2e@adgips.edu", password="pass", role=User.Role.FACULTY, first_name="Bob", last_name="Harris")

    f_alice = Faculty.objects.create(user=u_alice, department=dept, employee_id="FAC101", max_weekly_periods=12, max_daily_periods=3)
    f_bob = Faculty.objects.create(user=u_bob, department=dept, employee_id="FAC102", max_weekly_periods=12, max_daily_periods=3)

    # Subjects & Assignments
    sub_ds = Subject.objects.create(department=dept, code="CS301", name="Data Structures", subject_type=Subject.SubjectType.THEORY, weekly_periods=3, consecutive_slots=1)
    sub_lab = Subject.objects.create(department=dept, code="CS302", name="Data Structures Lab", subject_type=Subject.SubjectType.LAB, weekly_periods=2, consecutive_slots=2)

    FacultySubjectQualification.objects.create(faculty=f_alice, subject=sub_ds, preference_level=5)
    FacultySubjectQualification.objects.create(faculty=f_bob, subject=sub_lab, preference_level=5)

    SectionSubjectAssignment.objects.create(section=sec_a, subject=sub_ds, faculty=f_alice)
    SectionSubjectAssignment.objects.create(section=sec_a, subject=sub_lab, faculty=f_bob)

    # Student
    u_student = User.objects.create_user(username="student_jim", email="jim@adgips.edu", password="pass", role=User.Role.STUDENT, first_name="Jim", last_name="Halpert")
    StudentProfile.objects.create(user=u_student, department=dept, section=sec_a, enrollment_number="STU2024001")

    # Generate initial draft timetable
    scope = SchedulingScope(academic_year_id=ay.id, section_ids=[sec_a.id])
    res = TimetableGenerationEngine.generate(scope=scope, user=u_admin, timetable_name="Odd Sem 2024 CSE-3A")
    timetable = Timetable.objects.get(id=res.timetable_id)

    return {
        'college': college,
        'ay': ay,
        'shift': shift,
        'dept': dept,
        'sem': sem,
        'sec_a': sec_a,
        'c101': c101,
        'l201': l201,
        'f_alice': f_alice,
        'f_bob': f_bob,
        'sub_ds': sub_ds,
        'sub_lab': sub_lab,
        'timetable': timetable,
        'slots': slots,
        'admin': u_admin,
        'faculty_alice': u_alice,
        'faculty_bob': u_bob,
        'student': u_student,
    }


@pytest.mark.django_db
class TestTimetableE2EWorkflow:

    def test_e2e_full_lifecycle_generation_validation_publishing(self, e2e_fixture):
        """Verify complete workflow: generated draft -> revalidate -> publish -> student & faculty view."""
        f = e2e_fixture
        client = APIClient()
        tt = f['timetable']

        # 1. Admin validates draft
        client.force_authenticate(user=f['admin'])
        val_res = client.post(f"/api/v1/timetables/{tt.id}/validate/")
        assert val_res.status_code == status.HTTP_200_OK
        assert val_res.data['is_valid'] is True
        assert val_res.data['hard_constraint_violations'] == 0

        # Verify audit log created
        assert TimetableAuditLog.objects.filter(timetable=tt, action=TimetableAuditLog.Action.VALIDATED).exists()

        # 2. Before publish, student checks my-schedule -> not published yet
        client.force_authenticate(user=f['student'])
        stu_res = client.get("/api/v1/timetables/my-schedule/")
        assert stu_res.status_code == status.HTTP_200_OK
        assert stu_res.data['has_schedule'] is False
        assert "No published timetable" in stu_res.data['message']

        # 3. Admin publishes timetable
        client.force_authenticate(user=f['admin'])
        pub_res = client.post(f"/api/v1/timetables/{tt.id}/publish/")
        assert pub_res.status_code == status.HTTP_200_OK
        tt.refresh_from_db()
        assert tt.status == Timetable.Status.PUBLISHED
        assert tt.published_at is not None

        # 4. Student checks my-schedule -> published timetable returned
        client.force_authenticate(user=f['student'])
        stu_res2 = client.get("/api/v1/timetables/my-schedule/")
        assert stu_res2.status_code == status.HTTP_200_OK
        assert stu_res2.data['has_schedule'] is True
        assert stu_res2.data['role'] == 'STUDENT'
        assert len(stu_res2.data['entries']) == 5  # 3 theory + 2 lab

        # 5. Faculty Bob checks my-schedule -> teaching schedule returned
        client.force_authenticate(user=f['faculty_bob'])
        fac_res = client.get("/api/v1/timetables/my-schedule/")
        assert fac_res.status_code == status.HTTP_200_OK
        assert fac_res.data['has_schedule'] is True
        assert fac_res.data['role'] == 'FACULTY'
        assert len(fac_res.data['entries']) == 2  # Bob teaches the 2 lab slots

    def test_manual_entry_movement_and_atomic_conflict_rejection(self, e2e_fixture):
        """Verify manual class movement with collision, break, room type rejection and rollback."""
        f = e2e_fixture
        client = APIClient()
        client.force_authenticate(user=f['admin'])
        tt = f['timetable']

        # Pick one theory entry (taught by Alice in C101)
        theory_entry = tt.entries.filter(subject=f['sub_ds']).first()
        old_slot_id = theory_entry.period_slot_id

        # 1. Conflict: Attempt to move to a BREAK slot (Period 3)
        break_slot = PeriodSlot.objects.filter(shift=f['shift'], is_break=True).first()
        res_break = client.post(
            f"/api/v1/timetables/entry-records/{theory_entry.id}/move/",
            {"period_slot_id": break_slot.id},
            format='json'
        )
        assert res_break.status_code == status.HTTP_400_BAD_REQUEST
        assert res_break.data['conflict_code'] == 'BREAK_SLOT_VIOLATION'
        # Verify entry unchanged
        theory_entry.refresh_from_db()
        assert theory_entry.period_slot_id == old_slot_id

        # 2. Conflict: Attempt to move to an occupied slot (Section collision)
        other_entry = tt.entries.exclude(id=theory_entry.id).first()
        res_sec = client.post(
            f"/api/v1/timetables/entry-records/{theory_entry.id}/move/",
            {"period_slot_id": other_entry.period_slot_id},
            format='json'
        )
        assert res_sec.status_code == status.HTTP_400_BAD_REQUEST
        assert res_sec.data['conflict_code'] == 'SECTION_DOUBLE_BOOKING'
        theory_entry.refresh_from_db()
        assert theory_entry.period_slot_id == old_slot_id

        # 3. Conflict: Attempt to move a lab to non-lab classroom C101
        lab_entry = tt.entries.filter(subject=f['sub_lab']).first()
        free_slot = PeriodSlot.objects.filter(
            shift=f['shift'], is_break=False
        ).exclude(id__in=[e.period_slot_id for e in tt.entries.all()]).first()

        res_room_type = client.post(
            f"/api/v1/timetables/entry-records/{lab_entry.id}/move/",
            {"period_slot_id": free_slot.id, "room_id": f['c101'].id},
            format='json'
        )
        assert res_room_type.status_code == status.HTTP_400_BAD_REQUEST
        assert res_room_type.data['conflict_code'] == 'ROOM_TYPE_MISMATCH'

        # 4. Valid Move: Move theory entry to a valid empty slot in C101
        res_valid = client.post(
            f"/api/v1/timetables/entry-records/{theory_entry.id}/move/",
            {"period_slot_id": free_slot.id, "room_id": f['c101'].id},
            format='json'
        )
        assert res_valid.status_code == status.HTTP_200_OK
        theory_entry.refresh_from_db()
        assert theory_entry.period_slot_id == free_slot.id

        # Verify audit log recorded MANUAL_OVERRIDE
        assert TimetableAuditLog.objects.filter(
            timetable=tt, action=TimetableAuditLog.Action.MANUAL_OVERRIDE
        ).exists()

    def test_published_timetable_immutability_and_revision_forking(self, e2e_fixture):
        """Verify published timetables are immutable and creating revisions forks a new draft."""
        f = e2e_fixture
        client = APIClient()
        client.force_authenticate(user=f['admin'])
        tt = f['timetable']

        # Publish timetable
        client.post(f"/api/v1/timetables/{tt.id}/publish/")
        tt.refresh_from_db()
        assert tt.status == Timetable.Status.PUBLISHED

        # Attempt to edit entry in published timetable
        entry = tt.entries.first()
        free_slot = PeriodSlot.objects.filter(
            shift=f['shift'], is_break=False
        ).exclude(id__in=[e.period_slot_id for e in tt.entries.all()]).first()

        res_edit = client.post(
            f"/api/v1/timetables/entry-records/{entry.id}/move/",
            {"period_slot_id": free_slot.id},
            format='json'
        )
        assert res_edit.status_code == status.HTTP_400_BAD_REQUEST
        assert "Published timetables cannot be modified directly" in str(res_edit.data)

        # Fork new revision
        res_rev = client.post(f"/api/v1/timetables/{tt.id}/create-revision/")
        assert res_rev.status_code == status.HTTP_201_CREATED
        rev_id = res_rev.data['id']
        rev_tt = Timetable.objects.get(id=rev_id)

        assert rev_tt.status == Timetable.Status.DRAFT
        assert rev_tt.version == 2
        assert rev_tt.entries.count() == tt.entries.count()

        # The new draft revision CAN be modified
        rev_entry = rev_tt.entries.filter(subject=f['sub_ds']).first()
        res_rev_move = client.post(
            f"/api/v1/timetables/entry-records/{rev_entry.id}/move/",
            {"period_slot_id": free_slot.id},
            format='json'
        )
        assert res_rev_move.status_code == status.HTTP_200_OK

    def test_pdf_export_section_faculty_room(self, e2e_fixture):
        """Verify PDF generation for Section, Faculty, and Room produces valid PDF bytes."""
        f = e2e_fixture
        client = APIClient()
        client.force_authenticate(user=f['admin'])
        tt = f['timetable']

        # 1. Export Section PDF
        res_sec = client.get(f"/api/v1/timetables/{tt.id}/export-pdf/?type=section&section_id={f['sec_a'].id}")
        assert res_sec.status_code == status.HTTP_200_OK
        assert res_sec['Content-Type'] == 'application/pdf'
        assert res_sec.content.startswith(b'%PDF-')
        assert len(res_sec.content) > 1000

        # 2. Export Faculty PDF
        res_fac = client.get(f"/api/v1/timetables/{tt.id}/export-pdf/?type=faculty&faculty_id={f['f_alice'].id}")
        assert res_fac.status_code == status.HTTP_200_OK
        assert res_fac['Content-Type'] == 'application/pdf'
        assert res_fac.content.startswith(b'%PDF-')

        # 3. Export Room PDF
        res_room = client.get(f"/api/v1/timetables/{tt.id}/export-pdf/?type=room&room_id={f['c101'].id}")
        assert res_room.status_code == status.HTTP_200_OK
        assert res_room['Content-Type'] == 'application/pdf'
        assert res_room.content.startswith(b'%PDF-')

    def test_role_permissions_and_security(self, e2e_fixture):
        """Verify students cannot export unpublished timetables or other sections, non-admin cannot publish."""
        f = e2e_fixture
        client = APIClient()
        tt = f['timetable']  # DRAFT

        # 1. Student attempts to export DRAFT timetable -> 403/404 (draft invisible to students)
        client.force_authenticate(user=f['student'])
        res_stu = client.get(f"/api/v1/timetables/{tt.id}/export-pdf/?type=section&section_id={f['sec_a'].id}")
        assert res_stu.status_code in [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND]

        # 2. Student attempts to publish -> 403 Forbidden
        res_pub = client.post(f"/api/v1/timetables/{tt.id}/publish/")
        assert res_pub.status_code == status.HTTP_403_FORBIDDEN

        # 3. Student attempts to create revision -> 403 Forbidden
        res_rev = client.post(f"/api/v1/timetables/{tt.id}/create-revision/")
        assert res_rev.status_code == status.HTTP_403_FORBIDDEN

    def test_reporting_workload_and_room_utilization(self, e2e_fixture):
        """Verify summary reports for workload, room utilization, and general metrics."""
        f = e2e_fixture
        client = APIClient()
        client.force_authenticate(user=f['admin'])
        tt = f['timetable']

        # 1. Faculty Workload report
        res_wl = client.get(f"/api/v1/timetables/{tt.id}/reports/workload/")
        assert res_wl.status_code == status.HTTP_200_OK
        assert len(res_wl.data) == 2  # Alice and Bob
        # Alice teaches 3 periods
        alice_data = next(x for x in res_wl.data if x['faculty_id'] == f['f_alice'].id)
        assert alice_data['assigned_periods'] == 3
        assert alice_data['utilization_pct'] > 0

        # 2. Room Utilization report
        res_room = client.get(f"/api/v1/timetables/{tt.id}/reports/room-utilization/")
        assert res_room.status_code == status.HTTP_200_OK
        assert len(res_room.data) >= 2

        # 3. Timetable Summary report
        res_sum = client.get(f"/api/v1/timetables/{tt.id}/reports/summary/")
        assert res_sum.status_code == status.HTTP_200_OK
        assert res_sum.data['total_entries'] == 5
        assert res_sum.data['theory_entries'] == 3
        assert res_sum.data['lab_entries'] == 2
        assert res_sum.data['is_valid'] is True
