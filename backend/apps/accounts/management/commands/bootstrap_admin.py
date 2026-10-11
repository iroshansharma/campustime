"""
Management command to securely bootstrap or reset the administrator account.
Runs idempotently without interactive prompt, compatible with headless
cloud deployments (e.g. Render Free tier) without requiring Shell access.
"""

import os
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model


class Command(BaseCommand):
    help = 'Idempotently creates or resets an administrator account using environment variables or arguments.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            default=os.environ.get('ADMIN_BOOTSTRAP_USERNAME', 'admin'),
            help='Admin username (defaults to ADMIN_BOOTSTRAP_USERNAME or "admin")'
        )
        parser.add_argument(
            '--password',
            type=str,
            default=os.environ.get('ADMIN_BOOTSTRAP_PASSWORD', ''),
            help='Admin password (defaults to ADMIN_BOOTSTRAP_PASSWORD env var)'
        )
        parser.add_argument(
            '--email',
            type=str,
            default=os.environ.get('ADMIN_BOOTSTRAP_EMAIL', 'admin@campustime.local'),
            help='Admin email (defaults to ADMIN_BOOTSTRAP_EMAIL or "admin@campustime.local")'
        )

    def handle(self, *args, **options):
        username = options['username'].strip()
        password = options['password'].strip()
        email = options['email'].strip()

        if not password:
            self.stdout.write(
                self.style.WARNING(
                    "ADMIN_BOOTSTRAP_PASSWORD not provided. Skipping admin bootstrap."
                )
            )
            return

        if len(password) < 8:
            raise CommandError("Password must be at least 8 characters long.")

        User = get_user_model()
        user = User.objects.filter(username=username).first()

        if user:
            user.set_password(password)
            user.role = User.Role.ADMIN
            user.is_staff = True
            user.is_superuser = True
            user.is_active = True
            user.is_verified = True
            if email and (not user.email or user.email != email):
                if not User.objects.filter(email=email).exclude(pk=user.pk).exists():
                    user.email = email
            user.save()
            self.stdout.write(
                self.style.SUCCESS(
                    f"Successfully updated credentials and permissions for admin user '{username}'."
                )
            )
        else:
            if User.objects.filter(email=email).exists():
                email = f"{username}@{email.split('@')[-1] if '@' in email else 'campustime.local'}"
            user = User.objects.create_superuser(
                username=username,
                email=email,
                password=password
            )
            user.role = User.Role.ADMIN
            user.is_active = True
            user.is_verified = True
            user.save()
            self.stdout.write(
                self.style.SUCCESS(
                    f"Successfully created superuser '{username}'."
                )
            )
