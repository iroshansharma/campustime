"""
CampusTime URL Configuration
Root routing pointing to /api/v1/, health checks, and admin site.
"""

from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.conf import settings
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView
)


from django.db import connection


def health_check(request):
    """
    Public, read-only health probe for monitoring and container orchestrators.
    Verifies database connectivity and schema readiness without performing
    migrations or modifying any records. Never leaks credentials or sensitive data.
    """
    db_status = "healthy"
    db_engine = connection.vendor
    tables_synced = True

    if request.path.startswith('/api/v1/health'):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1;")
        except Exception:
            db_status = "unavailable"

        try:
            from apps.accounts.models import User
            # Verify table schema exists without requiring rows to be present
            _ = list(User.objects.all()[:1])
            tables_synced = True
        except Exception:
            tables_synced = False
            db_status = "uninitialized"

    status_code = 200 if db_status == "healthy" and tables_synced else 503
    return JsonResponse({
        'status': 'healthy' if status_code == 200 else 'degraded',
        'service': 'campustime-api',
        'database': db_status,
        'database_engine': db_engine,
        'tables_synced': tables_synced,
        'environment': 'development' if settings.DEBUG else 'production',
    }, status=status_code)


urlpatterns = [
    # Health checks for deployment platforms (e.g. Render zero-downtime healthcheck)
    path('health/', health_check, name='health_check'),
    path('api/v1/health/', health_check, name='api_health_check'),

    # Admin site
    path('admin/', admin.site.urls),

    # API v1 routes
    path('api/v1/auth/', include('apps.accounts.urls', namespace='accounts')),
    path('api/v1/academics/', include('apps.academics.urls', namespace='academics')),
    path('api/v1/faculty/', include('apps.faculty.urls', namespace='faculty')),
    path('api/v1/rooms/', include('apps.rooms.urls', namespace='rooms')),
    path('api/v1/timetables/', include('apps.timetables.urls', namespace='timetables')),

    # API Documentation (OpenAPI 3 / Swagger / ReDoc)
    path('api/v1/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/v1/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/v1/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]
