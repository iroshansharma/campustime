from datetime import date, time
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.academics.models import (
    College, AcademicYear, Shift, WorkingDay,
    PeriodSlot, Department, Semester, Section,
    Subject, SectionSubjectRequirement
)
from apps.faculty.models import (
    Faculty, FacultySubjectQualification,
    FacultyAvailability, SectionSubjectAssignment
)
from apps.rooms.models import Room, RoomAvailability

User = get_user_model()


class Command(BaseCommand):
    help = 'Idempotently seeds comprehensive, realistic academic data for CampusTime'

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("==> Seeding CampusTime Academic Data..."))

        # 1. Institutional Admin & Demo Users
        admin_user, _ = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@campustime.local',
                'first_name': 'Campus',
                'last_name': 'Administrator',
                'role': User.Role.ADMIN,
                'is_staff': True,
                'is_superuser': True,
            }
        )
        if not admin_user.has_usable_password():
            admin_user.set_password('AdminPass@123')
            admin_user.save()

        # 2. College
        college, _ = College.objects.update_or_create(
            code='ADGIPS',
            defaults={
                'name': 'Dr. Akhilesh Das Gupta Institute of Professional Studies',
                'address': 'FC-26, Shastri Park, New Delhi, Delhi 110053',
                'email': 'info@adgips.ac.in',
                'phone': '+91-11-49905900',
            }
        )

        # 3. Academic Year
        academic_year, _ = AcademicYear.objects.update_or_create(
            college=college,
            name='2024-2025',
            defaults={
                'start_date': date(2024, 8, 1),
                'end_date': date(2025, 5, 31),
                'is_current': True,
            }
        )

        # 4. Shifts
        shift_1, _ = Shift.objects.update_or_create(
            college=college,
            code='SHIFT_1',
            defaults={
                'name': 'Shift I (Morning)',
                'start_time': time(8, 30),
                'end_time': time(14, 30),
                'is_active': True,
            }
        )
        shift_2, _ = Shift.objects.update_or_create(
            college=college,
            code='SHIFT_2',
            defaults={
                'name': 'Shift II (Evening)',
                'start_time': time(12, 30),
                'end_time': time(18, 30),
                'is_active': True,
            }
        )

        # 5. Working Days
        days_data = [
            ('MON', 'Monday', 1),
            ('TUE', 'Tuesday', 2),
            ('WED', 'Wednesday', 3),
            ('THU', 'Thursday', 4),
            ('FRI', 'Friday', 5),
            ('SAT', 'Saturday', 6),
        ]
        for code, _, order in days_data:
            WorkingDay.objects.update_or_create(
                college=college,
                day=code,
                defaults={'order': order, 'is_active': True}
            )

        # 6. Period Slots for Shift I (Monday through Friday)
        # 6 teaching periods (55 min each) + 1 lunch break (30 min) = 7 slots
        slot_definitions = [
            (1, time(8, 30), time(9, 25), False, ''),
            (2, time(9, 25), time(10, 20), False, ''),
            (3, time(10, 20), time(11, 15), False, ''),
            (4, time(11, 15), time(11, 45), True, 'Lunch Break'),
            (5, time(11, 45), time(12, 40), False, ''),
            (6, time(12, 40), time(13, 35), False, ''),
            (7, time(13, 35), time(14, 30), False, ''),
        ]

        active_days = ['MON', 'TUE', 'WED', 'THU', 'FRI']
        created_slots = []
        for day in active_days:
            for p_num, s_time, e_time, is_brk, brk_lbl in slot_definitions:
                slot, _ = PeriodSlot.objects.update_or_create(
                    shift=shift_1,
                    day_of_week=day,
                    period_number=p_num,
                    defaults={
                        'start_time': s_time,
                        'end_time': e_time,
                        'is_break': is_brk,
                        'break_label': brk_lbl,
                    }
                )
                created_slots.append(slot)

        # 7. Departments
        dept_cse, _ = Department.objects.update_or_create(
            code='CSE',
            defaults={
                'college': college,
                'name': 'Computer Science & Engineering',
                'is_active': True,
            }
        )
        dept_it, _ = Department.objects.update_or_create(
            code='IT',
            defaults={
                'college': college,
                'name': 'Information Technology',
                'is_active': True,
            }
        )
        dept_ece, _ = Department.objects.update_or_create(
            code='ECE',
            defaults={
                'college': college,
                'name': 'Electronics & Communication Engineering',
                'is_active': True,
            }
        )

        # 8. Semesters
        sem_cse_5, _ = Semester.objects.update_or_create(
            academic_year=academic_year,
            department=dept_cse,
            semester_number=5,
            shift=shift_1,
            defaults={'is_active': True}
        )
        sem_cse_3, _ = Semester.objects.update_or_create(
            academic_year=academic_year,
            department=dept_cse,
            semester_number=3,
            shift=shift_1,
            defaults={'is_active': True}
        )

        # 9. Sections
        sec_cse_5a, _ = Section.objects.update_or_create(
            semester=sem_cse_5,
            name='A',
            defaults={'student_count': 60}
        )
        sec_cse_5b, _ = Section.objects.update_or_create(
            semester=sem_cse_5,
            name='B',
            defaults={'student_count': 60}
        )

        # 10. Subjects for CSE Sem 5
        subjects_spec = [
            ('CS-501', 'Database Management Systems', Subject.SubjectType.THEORY, 4, 4, 1),
            ('CS-502', 'Operating Systems', Subject.SubjectType.THEORY, 4, 4, 1),
            ('CS-503', 'Design & Analysis of Algorithms', Subject.SubjectType.THEORY, 4, 4, 1),
            ('CS-504', 'Software Engineering', Subject.SubjectType.THEORY, 3, 3, 1),
            ('CS-551', 'DBMS Laboratory', Subject.SubjectType.LAB, 2, 2, 2),
            ('CS-552', 'Algorithms Laboratory', Subject.SubjectType.LAB, 2, 2, 2),
        ]
        created_subjects = {}
        for code, name, stype, credits, weekly_p, consec_p in subjects_spec:
            sub, _ = Subject.objects.update_or_create(
                code=code,
                defaults={
                    'department': dept_cse,
                    'name': name,
                    'subject_type': stype,
                    'credits': credits,
                    'weekly_periods': weekly_p,
                    'consecutive_slots': consec_p,
                }
            )
            created_subjects[code] = sub

            # Also ensure SectionSubjectRequirement exists for each section
            for sec in [sec_cse_5a, sec_cse_5b]:
                SectionSubjectRequirement.objects.update_or_create(
                    section=sec,
                    subject=sub,
                    defaults={
                        'weekly_periods': weekly_p,
                        'consecutive_slots': consec_p,
                    }
                )

        # 11. Classrooms and Labs
        rooms_spec = [
            ('LH-101', 'Lecture Hall 101', Room.RoomType.CLASSROOM, 70, dept_cse),
            ('LH-102', 'Lecture Hall 102', Room.RoomType.CLASSROOM, 70, dept_cse),
            ('LH-201', 'Lecture Hall 201', Room.RoomType.CLASSROOM, 75, dept_cse),
            ('LAB-301', 'Database & Systems Lab', Room.RoomType.LAB, 65, dept_cse),
            ('LAB-302', 'Algorithms & AI Lab', Room.RoomType.LAB, 65, dept_cse),
            ('SEMINAR-1', 'Auditorium Seminar Hall', Room.RoomType.SEMINAR_HALL, 120, None),
        ]
        created_rooms = {}
        for r_code, r_name, r_type, cap, r_dept in rooms_spec:
            rm, _ = Room.objects.update_or_create(
                college=college,
                code=r_code,
                defaults={
                    'name': r_name,
                    'room_type': r_type,
                    'capacity': cap,
                    'department': r_dept,
                    'building': 'Academic Block A',
                    'floor': 1 if '1' in r_code else (2 if '2' in r_code else 3),
                    'is_active': True,
                }
            )
            created_rooms[r_code] = rm

        # 12. Faculty Members
        faculty_spec = [
            ('FAC001', 'dr.sharma', 'dr.sharma@campustime.local', 'Ramesh', 'Sharma', Faculty.Designation.PROFESSOR, 18, 4),
            ('FAC002', 'dr.verma', 'dr.verma@campustime.local', 'Ananya', 'Verma', Faculty.Designation.ASSOCIATE_PROF, 18, 4),
            ('FAC003', 'prof.kumar', 'prof.kumar@campustime.local', 'Rajesh', 'Kumar', Faculty.Designation.ASSISTANT_PROF, 20, 5),
            ('FAC004', 'dr.singh', 'dr.singh@campustime.local', 'Priya', 'Singh', Faculty.Designation.ASSISTANT_PROF, 20, 5),
            ('FAC005', 'prof.patel', 'prof.patel@campustime.local', 'Amit', 'Patel', Faculty.Designation.ASSISTANT_PROF, 20, 5),
        ]
        created_faculty = {}
        for emp_id, uname, email, fname, lname, desig, max_w, max_d in faculty_spec:
            u, _ = User.objects.get_or_create(
                username=uname,
                defaults={
                    'email': email,
                    'first_name': fname,
                    'last_name': lname,
                    'role': User.Role.FACULTY,
                    'is_staff': False,
                }
            )
            if not u.has_usable_password():
                u.set_password('FacultyPass@123')
                u.save()

            fac, _ = Faculty.objects.update_or_create(
                employee_id=emp_id,
                defaults={
                    'user': u,
                    'department': dept_cse,
                    'designation': desig,
                    'max_weekly_periods': max_w,
                    'max_daily_periods': max_d,
                    'is_active': True,
                }
            )
            created_faculty[emp_id] = fac

        # 13. Faculty Subject Qualifications
        qualifications_map = [
            ('FAC001', 'CS-501', 5),  # Dr. Sharma -> DBMS
            ('FAC001', 'CS-551', 5),  # Dr. Sharma -> DBMS Lab
            ('FAC002', 'CS-503', 5),  # Dr. Verma -> Algorithms
            ('FAC002', 'CS-552', 5),  # Dr. Verma -> Algorithms Lab
            ('FAC003', 'CS-502', 5),  # Prof. Kumar -> OS
            ('FAC004', 'CS-504', 5),  # Dr. Singh -> Software Eng
            ('FAC005', 'CS-501', 4),  # Prof. Patel -> DBMS
            ('FAC005', 'CS-551', 4),  # Prof. Patel -> DBMS Lab
            ('FAC005', 'CS-502', 3),  # Prof. Patel -> OS
        ]
        for emp_id, sub_code, pref in qualifications_map:
            FacultySubjectQualification.objects.update_or_create(
                faculty=created_faculty[emp_id],
                subject=created_subjects[sub_code],
                defaults={'preference_level': pref}
            )

        # 14. Section Subject Teaching Allocations
        # Section A:
        # CS-501 -> Dr. Sharma
        # CS-502 -> Prof. Kumar
        # CS-503 -> Dr. Verma
        # CS-504 -> Dr. Singh
        # CS-551 -> Dr. Sharma
        # CS-552 -> Dr. Verma
        sec_a_alloc = [
            ('CS-501', 'FAC001'),
            ('CS-502', 'FAC003'),
            ('CS-503', 'FAC002'),
            ('CS-504', 'FAC004'),
            ('CS-551', 'FAC001'),
            ('CS-552', 'FAC002'),
        ]
        for sub_code, emp_id in sec_a_alloc:
            SectionSubjectAssignment.objects.update_or_create(
                section=sec_cse_5a,
                subject=created_subjects[sub_code],
                faculty=created_faculty[emp_id],
                defaults={'is_primary': True}
            )

        # Section B:
        # CS-501 -> Prof. Patel
        # CS-502 -> Prof. Kumar
        # CS-503 -> Dr. Verma
        # CS-504 -> Dr. Singh
        # CS-551 -> Prof. Patel
        # CS-552 -> Dr. Verma
        sec_b_alloc = [
            ('CS-501', 'FAC005'),
            ('CS-502', 'FAC003'),
            ('CS-503', 'FAC002'),
            ('CS-504', 'FAC004'),
            ('CS-551', 'FAC005'),
            ('CS-552', 'FAC002'),
        ]
        for sub_code, emp_id in sec_b_alloc:
            SectionSubjectAssignment.objects.update_or_create(
                section=sec_cse_5b,
                subject=created_subjects[sub_code],
                faculty=created_faculty[emp_id],
                defaults={'is_primary': True}
            )

        # 15. Faculty Availability Setup
        # Seed availability for teaching slots (skip break slots)
        for fac in created_faculty.values():
            for slot in created_slots:
                if slot.is_break:
                    continue
                # Block Dr. Sharma Wednesday Period 1 for HOD Meeting
                is_avail = True
                reason = ''
                if fac.employee_id == 'FAC001' and slot.day_of_week == 'WED' and slot.period_number == 1:
                    is_avail = False
                    reason = 'Academic Council Meeting'

                FacultyAvailability.objects.update_or_create(
                    faculty=fac,
                    period_slot=slot,
                    defaults={'is_available': is_avail, 'reason': reason}
                )

        # 16. Room Availability Setup
        for rm in created_rooms.values():
            for slot in created_slots:
                if slot.is_break:
                    continue
                is_avail = True
                reason = ''
                # Block LAB-302 Friday Period 6 for Scheduled Server Maintenance
                if rm.code == 'LAB-302' and slot.day_of_week == 'FRI' and slot.period_number == 6:
                    is_avail = False
                    reason = 'Scheduled Hardware Maintenance'

                RoomAvailability.objects.update_or_create(
                    room=rm,
                    period_slot=slot,
                    defaults={'is_available': is_avail, 'reason': reason}
                )

        # 17. Demo Student Profile
        student_user, _ = User.objects.get_or_create(
            username='student1',
            defaults={
                'email': 'student1@campustime.local',
                'first_name': 'Rohan',
                'last_name': 'Mehta',
                'role': User.Role.STUDENT,
                'is_staff': False,
            }
        )
        if not student_user.has_usable_password():
            student_user.set_password('StudentPass@123')
            student_user.save()

        from apps.accounts.models import StudentProfile
        StudentProfile.objects.update_or_create(
            user=student_user,
            defaults={
                'enrollment_number': 'EN2022CSE045',
                'department': dept_cse,
                'section': sec_cse_5a,
                'batch_year': 2022,
            }
        )

        self.stdout.write(self.style.SUCCESS(
            "[SUCCESS] Academic data seeded successfully!\n"
            f"  - College: {college.name} ({college.code})\n"
            f"  - Academic Year: {academic_year.name}\n"
            f"  - Shifts: {Shift.objects.count()}, Period Slots: {PeriodSlot.objects.count()}\n"
            f"  - Departments: {Department.objects.count()}, Semesters: {Semester.objects.count()}, Sections: {Section.objects.count()}\n"
            f"  - Subjects: {Subject.objects.count()}, Classrooms/Labs: {Room.objects.count()}\n"
            f"  - Faculty Profiles: {Faculty.objects.count()}, Qualifications: {FacultySubjectQualification.objects.count()}\n"
            f"  - Teaching Assignments: {SectionSubjectAssignment.objects.count()}\n"
            f"  - Availability Slots: {FacultyAvailability.objects.count()} (Faculty), {RoomAvailability.objects.count()} (Rooms)"
        ))
