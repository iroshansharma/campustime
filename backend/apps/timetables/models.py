import uuid
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import UniqueConstraint


class Timetable(models.Model):
    """
    Master timetable record encapsulating versioning, workflow states,
    and associated schedule grid entries.
    """
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        REVIEW = 'REVIEW', 'Under Review'
        PUBLISHED = 'PUBLISHED', 'Published'
        ARCHIVED = 'ARCHIVED', 'Archived'

    academic_year = models.ForeignKey(
        'academics.AcademicYear',
        on_delete=models.CASCADE,
        related_name='timetables'
    )
    shift = models.ForeignKey(
        'academics.Shift',
        on_delete=models.CASCADE,
        related_name='timetables'
    )
    department = models.ForeignKey(
        'academics.Department',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='timetables',
        help_text='Null if comprehensive multi-department institutional schedule.'
    )
    semester = models.ForeignKey(
        'academics.Semester',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='timetables'
    )
    name = models.CharField(max_length=200, help_text='e.g., Odd Semester 2024-25 Timetable')
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True
    )
    version = models.PositiveIntegerField(
        default=1,
        help_text='Incremental version number for revisions.'
    )
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_timetables'
    )
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Timetable'
        verbose_name_plural = 'Timetables'
        ordering = ['-academic_year__start_date', '-version']
        constraints = [
            UniqueConstraint(
                fields=['academic_year', 'shift', 'department', 'semester', 'version'],
                name='unique_timetable_version_scope'
            )
        ]

    def __str__(self):
        dept_str = f" - {self.department.code}" if self.department else ""
        return f"{self.name} v{self.version} [{self.get_status_display()}]{dept_str}"


class TimetableEntry(models.Model):
    """
    Individual scheduled period cell in a timetable grid.
    Strict database constraints guarantee zero room, faculty, or section collisions.
    """
    timetable = models.ForeignKey(
        Timetable,
        on_delete=models.CASCADE,
        related_name='entries'
    )
    section = models.ForeignKey(
        'academics.Section',
        on_delete=models.CASCADE,
        related_name='timetable_entries'
    )
    subject = models.ForeignKey(
        'academics.Subject',
        on_delete=models.CASCADE,
        related_name='timetable_entries'
    )
    faculty = models.ForeignKey(
        'faculty.Faculty',
        on_delete=models.CASCADE,
        related_name='timetable_entries'
    )
    room = models.ForeignKey(
        'rooms.Room',
        on_delete=models.CASCADE,
        related_name='timetable_entries'
    )
    period_slot = models.ForeignKey(
        'academics.PeriodSlot',
        on_delete=models.CASCADE,
        related_name='timetable_entries'
    )
    day_of_week = models.CharField(
        max_length=3,
        choices=[
            ('MON', 'Monday'), ('TUE', 'Tuesday'), ('WED', 'Wednesday'),
            ('THU', 'Thursday'), ('FRI', 'Friday'), ('SAT', 'Saturday')
        ],
        db_index=True
    )
    is_locked = models.BooleanField(
        default=False,
        help_text='Pinned manually by admin; CSP generator will preserve this slot.'
    )
    linked_session_id = models.UUIDField(
        default=None,
        null=True,
        blank=True,
        db_index=True,
        help_text='Shared UUID for consecutive multi-period blocks (e.g. 2-hour or 3-hour labs).'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Timetable Entry'
        verbose_name_plural = 'Timetable Entries'
        ordering = ['period_slot__period_number']
        constraints = [
            # Hard Constraint 1: Room cannot be double-booked in the same timetable slot
            UniqueConstraint(
                fields=['timetable', 'room', 'period_slot'],
                name='unique_timetable_room_slot_booking'
            ),
            # Hard Constraint 2: Faculty cannot teach two classes simultaneously
            UniqueConstraint(
                fields=['timetable', 'faculty', 'period_slot'],
                name='unique_timetable_faculty_slot_booking'
            ),
            # Hard Constraint 3: Section cannot attend two subjects simultaneously
            UniqueConstraint(
                fields=['timetable', 'section', 'period_slot'],
                name='unique_timetable_section_slot_booking'
            ),
        ]

    def clean(self):
        # Validation 1: Cannot schedule a lecture during a break slot
        if self.period_slot.is_break:
            raise ValidationError({
                'period_slot': f"Cannot schedule a class during break slot '{self.period_slot.break_label}'."
            })

        # Validation 2: Ensure day of week matches period_slot
        if self.day_of_week != self.period_slot.day_of_week:
            self.day_of_week = self.period_slot.day_of_week

        # Validation 3: Room capacity check
        if self.room.capacity < self.section.student_count:
            raise ValidationError({
                'room': (
                    f"Room '{self.room.code}' capacity ({self.room.capacity}) is insufficient "
                    f"for Section '{self.section}' headcount ({self.section.student_count})."
                )
            })

        # Validation 4: Lab subject requires Lab room
        if self.subject.subject_type == 'LAB' and self.room.room_type != 'LAB':
            raise ValidationError({
                'room': f"Laboratory subject '{self.subject.code}' must be scheduled in a LAB room."
            })

    def save(self, *args, **kwargs):
        if self.period_slot:
            self.day_of_week = self.period_slot.day_of_week
        super().save(*args, **kwargs)

    def __str__(self):
        return (
            f"[{self.timetable.name}] {self.section} | {self.subject.code} | "
            f"{self.faculty.user.last_name or self.faculty.user.username} | "
            f"{self.room.code} @ {self.period_slot}"
        )
