from django.conf import settings
from django.db import models


class TimetableAuditLog(models.Model):
    """
    Append-only historical audit trail of all timetable generation,
    slot modifications, validations, approvals, and publications.
    """
    class Action(models.TextChoices):
        GENERATED = 'GENERATED', 'Timetable Generated'
        UPDATED = 'UPDATED', 'Entry Updated'
        SLOT_LOCKED = 'SLOT_LOCKED', 'Slot Locked/Unlocked'
        VALIDATED = 'VALIDATED', 'Timetable Validated'
        PUBLISHED = 'PUBLISHED', 'Timetable Published'
        ARCHIVED = 'ARCHIVED', 'Timetable Archived'
        REVERTED = 'REVERTED', 'Timetable Reverted'
        MANUAL_OVERRIDE = 'MANUAL_OVERRIDE', 'Manual Entry Override'

    timetable = models.ForeignKey(
        'timetables.Timetable',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs'
    )
    action = models.CharField(
        max_length=30,
        choices=Action.choices,
        db_index=True
    )
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    notes = models.TextField(blank=True)
    diff_payload = models.JSONField(
        default=dict,
        blank=True,
        help_text='JSON diff recording previous state vs updated state.'
    )

    class Meta:
        verbose_name = 'Timetable Audit Log'
        verbose_name_plural = 'Timetable Audit Logs'
        ordering = ['-timestamp']

    def __str__(self):
        user_name = self.user.username if self.user else "System"
        tt_name = self.timetable.name if self.timetable else "Global"
        return f"[{self.timestamp.strftime('%Y-%m-%d %H:%M')}] {self.get_action_display()} on '{tt_name}' by {user_name}"
