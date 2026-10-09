from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q, CheckConstraint, UniqueConstraint


class College(models.Model):
    """Institutional root information."""
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50, unique=True)
    address = models.TextField(blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'College'
        verbose_name_plural = 'Colleges'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.code})"


class AcademicYear(models.Model):
    """Academic year defining schedule cycles (e.g., 2024-2025)."""
    college = models.ForeignKey(College, on_delete=models.CASCADE, related_name='academic_years')
    name = models.CharField(max_length=50, help_text='e.g., 2024-2025')
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Academic Year'
        verbose_name_plural = 'Academic Years'
        ordering = ['-start_date']
        constraints = [
            CheckConstraint(
                condition=Q(start_date__lt=F('end_date')),
                name='academic_year_start_before_end'
            ),
            UniqueConstraint(
                fields=['college', 'name'],
                name='unique_college_academic_year_name'
            )
        ]

    def clean(self):
        if self.start_date and self.end_date and self.start_date >= self.end_date:
            raise ValidationError({'end_date': 'End date must be strictly after start date.'})

    def __str__(self):
        return f"{self.name}{' (Current)' if self.is_current else ''}"


class Shift(models.Model):
    """Institutional shifts (e.g., Shift I Morning, Shift II Evening)."""
    college = models.ForeignKey(College, on_delete=models.CASCADE, related_name='shifts')
    name = models.CharField(max_length=100, help_text='e.g., Shift I (Morning)')
    code = models.CharField(max_length=20, help_text='e.g., SHIFT_1')
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Shift'
        verbose_name_plural = 'Shifts'
        ordering = ['start_time']
        constraints = [
            CheckConstraint(
                condition=Q(start_time__lt=F('end_time')),
                name='shift_start_before_end'
            ),
            UniqueConstraint(
                fields=['college', 'code'],
                name='unique_college_shift_code'
            )
        ]

    def clean(self):
        if self.start_time and self.end_time and self.start_time >= self.end_time:
            raise ValidationError({'end_time': 'Shift end time must be after start time.'})

    def __str__(self):
        return f"{self.name} ({self.start_time.strftime('%H:%M')} - {self.end_time.strftime('%H:%M')})"


class WorkingDay(models.Model):
    """Configured working days in the week."""
    class Day(models.TextChoices):
        MON = 'MON', 'Monday'
        TUE = 'TUE', 'Tuesday'
        WED = 'WED', 'Wednesday'
        THU = 'THU', 'Thursday'
        FRI = 'FRI', 'Friday'
        SAT = 'SAT', 'Saturday'

    college = models.ForeignKey(College, on_delete=models.CASCADE, related_name='working_days')
    day = models.CharField(max_length=3, choices=Day.choices)
    order = models.PositiveSmallIntegerField(help_text='1 for Monday, 6 for Saturday')
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Working Day'
        verbose_name_plural = 'Working Days'
        ordering = ['order']
        constraints = [
            UniqueConstraint(
                fields=['college', 'day'],
                name='unique_college_working_day'
            )
        ]

    def __str__(self):
        return f"{self.get_day_display()}"


class PeriodSlot(models.Model):
    """
    Individual lecture or break period slot defined within a shift and day.
    """
    shift = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name='period_slots')
    day_of_week = models.CharField(max_length=3, choices=WorkingDay.Day.choices, db_index=True)
    period_number = models.PositiveSmallIntegerField(help_text='Ordinal index of period (1..N)')
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_break = models.BooleanField(default=False, help_text='True for lunch or recess breaks')
    break_label = models.CharField(max_length=50, blank=True, help_text='e.g., Lunch Break')

    class Meta:
        verbose_name = 'Period Slot'
        verbose_name_plural = 'Period Slots'
        ordering = ['shift', 'day_of_week', 'period_number']
        constraints = [
            CheckConstraint(
                condition=Q(start_time__lt=F('end_time')),
                name='period_slot_start_before_end'
            ),
            UniqueConstraint(
                fields=['shift', 'day_of_week', 'period_number'],
                name='unique_shift_day_period'
            )
        ]

    def clean(self):
        if self.start_time and self.end_time and self.start_time >= self.end_time:
            raise ValidationError({'end_time': 'Period end time must be after start time.'})
        if self.is_break and not self.break_label:
            self.break_label = 'Break'

    def __str__(self):
        tag = f" [{self.break_label}]" if self.is_break else ""
        return f"{self.shift.name} | {self.get_day_of_week_display()} P{self.period_number} ({self.start_time.strftime('%H:%M')}-{self.end_time.strftime('%H:%M')}){tag}"


class Department(models.Model):
    """Academic departments (e.g. CSE, ECE, IT, ME)."""
    college = models.ForeignKey(College, on_delete=models.CASCADE, related_name='departments')
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=20, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Department'
        verbose_name_plural = 'Departments'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.code})"


class Semester(models.Model):
    """Academic semester per department, academic year, and shift."""
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE, related_name='semesters')
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='semesters')
    semester_number = models.PositiveSmallIntegerField(help_text='Semester 1 through 8')
    shift = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name='semesters')
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Semester'
        verbose_name_plural = 'Semesters'
        ordering = ['department', 'semester_number']
        constraints = [
            CheckConstraint(
                condition=Q(semester_number__gte=1) & Q(semester_number__lte=12),
                name='semester_number_range_1_to_12'
            ),
            UniqueConstraint(
                fields=['academic_year', 'department', 'semester_number', 'shift'],
                name='unique_semester_offering'
            )
        ]

    def __str__(self):
        return f"{self.department.code} - Sem {self.semester_number} ({self.shift.name})"


class Section(models.Model):
    """Specific cohort of students within a semester."""
    semester = models.ForeignKey(Semester, on_delete=models.CASCADE, related_name='sections')
    name = models.CharField(max_length=20, help_text='e.g., A, B, C or Sec-1')
    student_count = models.PositiveIntegerField(default=60, help_text='Enrolled student headcount')

    class Meta:
        verbose_name = 'Section'
        verbose_name_plural = 'Sections'
        ordering = ['semester', 'name']
        constraints = [
            CheckConstraint(
                condition=Q(student_count__gt=0),
                name='section_student_count_positive'
            ),
            UniqueConstraint(
                fields=['semester', 'name'],
                name='unique_section_per_semester'
            )
        ]

    def __str__(self):
        return f"{self.semester.department.code} S{self.semester.semester_number}-{self.name}"


class Subject(models.Model):
    """Curriculum subject offered by a department."""
    class SubjectType(models.TextChoices):
        THEORY = 'THEORY', 'Theory'
        LAB = 'LAB', 'Practical / Laboratory'
        SEMINAR = 'SEMINAR', 'Seminar / Project'

    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='subjects')
    code = models.CharField(max_length=30, unique=True, help_text='e.g., CS-501')
    name = models.CharField(max_length=150)
    subject_type = models.CharField(max_length=20, choices=SubjectType.choices, default=SubjectType.THEORY)
    credits = models.PositiveSmallIntegerField(default=3)
    weekly_periods = models.PositiveSmallIntegerField(
        default=4,
        help_text='Target total number of periods per week'
    )
    consecutive_slots = models.PositiveSmallIntegerField(
        default=1,
        help_text='Consecutive periods required in a block (1 for theory, 2 or 3 for labs)'
    )

    class Meta:
        verbose_name = 'Subject'
        verbose_name_plural = 'Subjects'
        ordering = ['code']
        constraints = [
            CheckConstraint(
                condition=Q(weekly_periods__gt=0),
                name='subject_weekly_periods_positive'
            ),
            CheckConstraint(
                condition=Q(consecutive_slots__gt=0),
                name='subject_consecutive_slots_positive'
            ),
            CheckConstraint(
                condition=Q(consecutive_slots__lte=F('weekly_periods')),
                name='subject_consecutive_lte_weekly'
            )
        ]

    def clean(self):
        if self.consecutive_slots > self.weekly_periods:
            raise ValidationError({'consecutive_slots': 'Consecutive slots cannot exceed total weekly periods.'})
        if self.weekly_periods % self.consecutive_slots != 0:
            raise ValidationError({
                'consecutive_slots': (
                    f"Weekly periods ({self.weekly_periods}) must be divisible by "
                    f"consecutive slot size ({self.consecutive_slots}) for structured block scheduling."
                )
            })

    def __str__(self):
        return f"{self.code} - {self.name} ({self.get_subject_type_display()})"


class SectionSubjectRequirement(models.Model):
    """Section-specific subject requirements overriding department defaults if needed."""
    section = models.ForeignKey(Section, on_delete=models.CASCADE, related_name='subject_requirements')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='section_requirements')
    weekly_periods = models.PositiveSmallIntegerField()
    consecutive_slots = models.PositiveSmallIntegerField(default=1)

    class Meta:
        verbose_name = 'Section Subject Requirement'
        verbose_name_plural = 'Section Subject Requirements'
        constraints = [
            CheckConstraint(
                condition=Q(weekly_periods__gt=0),
                name='requirement_weekly_periods_positive'
            ),
            CheckConstraint(
                condition=Q(consecutive_slots__gt=0),
                name='requirement_consecutive_slots_positive'
            ),
            CheckConstraint(
                condition=Q(consecutive_slots__lte=F('weekly_periods')),
                name='requirement_consecutive_lte_weekly'
            ),
            UniqueConstraint(
                fields=['section', 'subject'],
                name='unique_section_subject_requirement'
            )
        ]

    def __str__(self):
        return f"{self.section} -> {self.subject.code} ({self.weekly_periods} periods/wk)"
