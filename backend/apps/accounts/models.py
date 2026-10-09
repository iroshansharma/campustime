from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    """Custom manager for User with email as required unique field."""

    def create_user(self, username, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field is required.')
        email = self.normalize_email(email)
        user = self.model(username=username, email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', User.Role.ADMIN)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(username, email, password, **extra_fields)


class User(AbstractUser):
    """
    Custom user model supporting distinct roles:
    ADMIN: Manages academics, constraints, and timetable publishing.
    FACULTY: Views their teaching schedules and sets availability.
    STUDENT: Views published section schedules.
    """

    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Administrator'
        FACULTY = 'FACULTY', 'Faculty Member'
        STUDENT = 'STUDENT', 'Student'

    email = models.EmailField(unique=True, db_index=True)
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.ADMIN,
        db_index=True,
        help_text='Institutional role defining application permissions.'
    )
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    is_verified = models.BooleanField(default=True)

    objects = UserManager()

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        ordering = ['username']

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

    @property
    def is_admin_role(self):
        return self.role == self.Role.ADMIN or self.is_superuser

    @property
    def is_faculty_role(self):
        return self.role == self.Role.FACULTY

    @property
    def is_student_role(self):
        return self.role == self.Role.STUDENT


class StudentProfile(models.Model):
    """Profile details for enrolled students."""
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='student_profile'
    )
    enrollment_number = models.CharField(max_length=50, unique=True, db_index=True)
    department = models.ForeignKey(
        'academics.Department',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='students'
    )
    section = models.ForeignKey(
        'academics.Section',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='students'
    )
    batch_year = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        verbose_name = 'Student Profile'
        verbose_name_plural = 'Student Profiles'

    def __str__(self):
        return f"{self.enrollment_number} - {self.user.get_full_name() or self.user.username}"
