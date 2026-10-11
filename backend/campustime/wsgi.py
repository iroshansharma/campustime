"""
WSGI config for CampusTime project.
"""

import os
import logging
from django.core.wsgi import get_wsgi_application

logger = logging.getLogger('campustime')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'campustime.settings')
application = get_wsgi_application()

# Self-healing startup check for cloud instances (e.g. Render free tier)
try:
    from apps.accounts.models import User
    _ = User.objects.exists()
except Exception:
    try:
        from django.core.management import call_command
        logger.info("Initializing database migrations on WSGI startup...")
        call_command('migrate', interactive=False)
        call_command('seed_academic_data')
        logger.info("Database initialized successfully.")
    except Exception as exc:
        logger.error("Startup migration check error: %s", exc)
