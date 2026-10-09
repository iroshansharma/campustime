from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q, CheckConstraint, UniqueConstraint


class Room(models.Model):
    """Physical learning spaces (lecture halls, specialized laboratories, seminar halls)."""
    class RoomType(models.TextChoices):
        CLASSROOM = 'CLASSROOM', 'Classroom / Lecture Hall'
        LAB = 'LAB', 'Computer / Hardware Lab'
        SEMINAR_HALL = 'SEMINAR_HALL', 'Seminar Hall'

    college = models.ForeignKey(
        'academics.College',
        on_delete=models.CASCADE,
        related_name='rooms'
    )
    department = models.ForeignKey(
        'academics.Department',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='dedicated_rooms',
        help_text='Null if shared facility across all departments.'
    )
    name = models.CharField(max_length=100, help_text='e.g., Lecture Hall 101, Lab 3')
    code = models.CharField(max_length=30, help_text='e.g., LH-101, LAB-3')
    room_type = models.CharField(
        max_length=20,
        choices=RoomType.choices,
        default=RoomType.CLASSROOM
    )
    capacity = models.PositiveIntegerField(
        default=60,
        help_text='Maximum student seating capacity.'
    )
    building = models.CharField(max_length=100, blank=True)
    floor = models.IntegerField(default=1)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Room'
        verbose_name_plural = 'Rooms'
        ordering = ['code']
        constraints = [
            CheckConstraint(
                condition=Q(capacity__gt=0),
                name='room_capacity_positive'
            ),
            UniqueConstraint(
                fields=['college', 'code'],
                name='unique_college_room_code'
            )
        ]

    def clean(self):
        if self.capacity <= 0:
            raise ValidationError({'capacity': 'Room capacity must be greater than zero.'})

    def __str__(self):
        dept_str = f" [{self.department.code}]" if self.department else ""
        return f"{self.code} - {self.name} ({self.get_room_type_display()}, Cap: {self.capacity}){dept_str}"


class RoomAvailability(models.Model):
    """
    Availability declaration for a physical room/lab.
    Allows blocking rooms for maintenance, exams, or department-only slots.
    """
    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name='availabilities'
    )
    period_slot = models.ForeignKey(
        'academics.PeriodSlot',
        on_delete=models.CASCADE,
        related_name='room_availabilities'
    )
    is_available = models.BooleanField(
        default=True,
        help_text='True if room is open for regular scheduling.'
    )
    reason = models.CharField(max_length=200, blank=True, help_text='e.g., Reserved for Lab Maintenance')

    class Meta:
        verbose_name = 'Room Availability'
        verbose_name_plural = 'Room Availabilities'
        constraints = [
            UniqueConstraint(
                fields=['room', 'period_slot'],
                name='unique_room_period_slot_availability'
            )
        ]

    def __str__(self):
        status = "Available" if self.is_available else f"Unavailable ({self.reason or 'Blocked'})"
        return f"{self.room.code} @ {self.period_slot} : {status}"
