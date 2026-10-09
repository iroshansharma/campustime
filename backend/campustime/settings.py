"""
Django settings for CampusTime project.
Production-ready configuration supporting environment variables,
PostgreSQL with graceful SQLite development fallback, SimpleJWT,
and granular Role-Based Access Control.
"""

from datetime import timedelta
from pathlib import Path
import os
import environ

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Initialize environment variables
env = environ.Env(
    DEBUG=(bool, True),
    SECRET_KEY=(str, 'django-insecure-campustime-dev-secret-key-change-in-production-^99*#'),
    ALLOWED_HOSTS=(list, ['localhost', '127.0.0.1', '*']),
    DATABASE_URL=(str, ''),
    USE_SQLITE=(bool, False),
    CORS_ALLOWED_ORIGINS=(list, ['http://localhost:5173', 'http://127.0.0.1:5173']),
)

# Read from .env at workspace root or backend dir if present
root_env = BASE_DIR.parent / '.env'
backend_env = BASE_DIR / '.env'
if root_env.exists():
    environ.Env.read_env(root_env)
elif backend_env.exists():
    environ.Env.read_env(backend_env)

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env('SECRET_KEY')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env('DEBUG')

ALLOWED_HOSTS = env('ALLOWED_HOSTS')

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'drf_spectacular',

    # Local CampusTime apps
    'apps.accounts.apps.AccountsConfig',
    'apps.academics.apps.AcademicsConfig',
    'apps.faculty.apps.FacultyConfig',
    'apps.rooms.apps.RoomsConfig',
    'apps.timetables.apps.TimetablesConfig',
    'apps.scheduling.apps.SchedulingConfig',
    'apps.audit.apps.AuditConfig',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'campustime.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'campustime.wsgi.application'
ASGI_APPLICATION = 'campustime.asgi.application'

# Database Configuration
# Support PostgreSQL via DATABASE_URL; fallback to SQLite for local development
db_url = env('DATABASE_URL')
use_sqlite = env('USE_SQLITE')

if db_url and not use_sqlite:
    try:
        DATABASES = {
            'default': env.db_url('DATABASE_URL')
        }
    except Exception:
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': BASE_DIR / 'db.sqlite3',
            }
        }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# Custom User Model
AUTH_USER_MODEL = 'accounts.User'

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {'min_length': 8},
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Django REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ),
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'CampusTime Timetable Management API',
    'DESCRIPTION': 'RESTful API for collegiate timetable generation, faculty workload, and academic management.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
}

# SimpleJWT Configuration
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=env.int('JWT_ACCESS_TOKEN_LIFETIME_MINUTES', default=60)),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=env.int('JWT_REFRESH_TOKEN_DAYS', default=7)),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
}

# CORS Configuration
CORS_ALLOWED_ORIGINS = env('CORS_ALLOWED_ORIGINS')
CORS_ALLOW_CREDENTIALS = True

# Timetable Engine & Scheduler Configuration
# Loaded from environment (.env) with strict validation
_scheduler_timeout_raw = env('SCHEDULER_TIMEOUT_SECONDS', default=60.0)
try:
    SCHEDULER_TIMEOUT_SECONDS = float(_scheduler_timeout_raw)
    if SCHEDULER_TIMEOUT_SECONDS <= 0:
        raise ValueError("SCHEDULER_TIMEOUT_SECONDS must be positive.")
except (ValueError, TypeError) as exc:
    raise ValueError(f"Invalid SCHEDULER_TIMEOUT_SECONDS environment configuration: {exc}")

_scheduler_backtracks_raw = env('SCHEDULER_MAX_BACKTRACK_STEPS', default=50000)
try:
    SCHEDULER_MAX_BACKTRACK_STEPS = int(_scheduler_backtracks_raw)
    if SCHEDULER_MAX_BACKTRACK_STEPS <= 0:
        raise ValueError("SCHEDULER_MAX_BACKTRACK_STEPS must be positive.")
except (ValueError, TypeError) as exc:
    raise ValueError(f"Invalid SCHEDULER_MAX_BACKTRACK_STEPS environment configuration: {exc}")

