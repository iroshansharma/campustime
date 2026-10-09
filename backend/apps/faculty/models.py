from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q, CheckConstraint, UniqueConstraint


class Faculty(models.Model):
    """Faculty profile detailing institutional position and workload limits."""
    class Designation(models.TextChoices):
        PROFESSOR = 'PROFESSOR', 'Professor'
        ASSOCIATE_PROF = 'ASSOCIATE_PROF', 'Associate Professor'
        ASSISTANT_PROF = 'ASSISTANT_PROF', 'Assistant Professor'
        LECTURER = 'LECTURER', 'Lecturer'
        GUEST_FACULTY = 'GUEST_FACULTY', 'Guest Faculty'

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='faculty_profile'
    )
    employee_id = models.CharField(max_length=50, unique=True, db_index=True)
    department = models.ForeignKey(
        'academics.Department',
        on_delete=models.CASCADE,
        related_name='faculty_members'
    )
    designation = models.CharField(
        max_length=30,
        choices=Designation.choices,
        default=Designation.ASSISTANT_PROF
    )
    max_weekly_periods = models.PositiveSmallIntegerField(
        default=18,
        help_text='Maximum allowed teaching periods per week.'
    )
    max_daily_periods = models.PositiveSmallIntegerField(
        default=4,
        help_text='Maximum allowed teaching periods in a single day.'
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Faculty'
        verbose_name_plural = 'Faculty'
        ordering = ['user__first_name', 'user__last_name']
        constraints = [
            CheckConstraint(
                condition=Q(max_weekly_periods__gt=0),
                name='faculty_max_weekly_periods_positive'
            ),
            CheckConstraint(
                condition=Q(max_daily_periods__gt=0),
                name='faculty_max_daily_periods_positive'
            ),
            CheckConstraint(
                condition=Q(max_daily_periods__lte=F('max_weekly_periods')),
                name='faculty_daily_lte_weekly_periods'
            )
        ]

    def clean(self):
        if self.max_daily_periods > self.max_weekly_periods:
            raise ValidationError({
                'max_daily_periods': 'Maximum daily periods cannot exceed maximum weekly periods.'
            })

    def __str__(self):
        name = self.user.get_full_name() or self.user.username
        return f"{name} ({self.employee_id}) - {self.get_designation_display()}"


class FacultySubjectQualification(models.Model):
    """
    Explicit qualification mapping: Faculty eligible to teach a subject,
    with an optional affinity/preference ranking (1=lowest, 5=highest).
    """
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name='qualifications')
    subject = models.ForeignKey('academics.Subject', on_delete=models.CASCADE, related_name='qualified_faculty')
    preference_level = models.PositiveSmallIntegerField(
        default=3,
        help_text='Preference score from 1 (lowest) to 5 (highest)'
    )

    class Meta:
        verbose_name = 'Faculty Subject Qualification'
        verbose_name_plural = 'Faculty Subject Qualifications'
        constraints = [
            CheckConstraint(
                condition=Q(preference_level__gte=1) & Q(preference_level__lte=5),
                name='preference_level_range_1_to_5'
            ),
            UniqueConstraint(
                fields=['faculty', 'subject'],
                name='unique_faculty_subject_qualification'
            )
        ]

    def __str__(self):
        return f"{self.faculty} -> {self.subject.code} (Pref: {self.preference_level})"


class FacultyAvailability(models.Model):
    """
    Day and period slot availability declaration for a faculty member.
    Allows faculty or admin to block off research, meeting, or leave slots.
    """
    faculty = models.ForeignKey(Faculty, on_delete=models.CASCADE, related_name='availabilities')
    period_slot = models.ForeignKey(
        'academics.PeriodSlot',
        on_delete=models.CASCADE,
        related_name='faculty_availabilities'
    )
    is_available = models.BooleanField(
        default=True,
        help_text='True if faculty is available to teach during this slot.'
    )
    is_preferred = models.BooleanField(
        default=False,
        help_text='True if faculty explicitly prefers teaching during this slot.'
    )
    reason = models.CharField(max_length=200, blank=True, help_text='e.g., Dept Meeting, Off-Campus Research')

    class Meta:
        verbose_name = 'Faculty Availability'
        verbose_name_plural = 'Faculty Availabilities'
        constraints = [
            UniqueConstraint(
                fields=['faculty', 'period_slot'],
                name='unique_faculty_period_slot_availability'
            )
        ]

    def __str__(self):
        status = "Available" if self.is_available else f"Unavailable ({self.reason or 'Blocked'})"
        return f"{self.faculty.employee_id} @ {self.period_slot} : {status}"


class SectionSubjectAssignment(models.Model):
    """
    Teacher allocation: Which faculty member is assigned to teach a subject
    for a given section. Multiple instructors can be linked (e.g. lab pairs)
    with one designated as primary.
    """
    section = models.ForeignKey(
        'academics.Section',
        on_delete=models.CASCADE,
        related_name='teaching_assignments'
    )
    subject = models.ForeignKey(
        'academics.Subject',
        on_delete=models.CASCADE,
        related_name='teaching_assignments'
    )
    faculty = models.ForeignKey(
        Faculty,
        on_delete=models.CASCADE,
        related_name='teaching_assignments'
    )
    is_primary = models.BooleanField(
        default=True,
        help_text='Lead instructor responsible for grading and primary sessions.'
    )

    class Meta:
        verbose_name = 'Section Subject Assignment'
        verbose_name_plural = 'Section Subject Assignments'
        constraints = [
            UniqueConstraint(
                fields=['section', 'subject', 'faculty'],
                name='unique_section_subject_faculty_assignment'
            )
        ]

    def clean(self):
        # 1. Subject qualification check
        if self.faculty_id and self.subject_id:
            if not FacultySubjectQualification.objects.filter(faculty=self.faculty, subject=self.subject).exists():
                raise ValidationError({
                    'faculty': f"Faculty member '{self.faculty.user.get_full_name() or self.faculty.user.username}' is not qualified to teach '{self.subject.code}'."
                })

        # 2. Cross-college check
        if self.section_id and self.faculty_id:
            section_college_id = self.section.semester.department.college_id
            faculty_college_id = self.faculty.department.college_id
            if section_college_id != faculty_college_id:
                raise ValidationError({
                    'faculty': f"Faculty belongs to a different institution than Section '{self.section}'."
                })

        # 3. Workload limits check
        if self.faculty_id and self.subject_id:
            assigned_qs = SectionSubjectAssignment.objects.filter(faculty=self.faculty)
            if self.pk:
                assigned_qs = assigned_qs.exclude(pk=self.pk)
            total_weekly = sum(a.subject.weekly_periods for a in assigned_qs.select_related('subject'))
            if total_weekly + self.subject.weekly_periods > self.faculty.max_weekly_periods:
                raise ValidationError({
                    'faculty': (
                        f"Assigning '{self.subject.code}' ({self.subject.weekly_periods} periods/wk) exceeds "
                        f"faculty max weekly limit ({self.faculty.max_weekly_periods} periods/wk). "
                        f"Currently assigned: {total_weekly} periods/wk."
                    )
                })

    def __str__(self):
        role = "Primary" if self.is_primary else "Assistant"
        return f"{self.section} | {self.subject.code} -> {self.faculty.user.last_name or self.faculty.user.username} ({role})"
