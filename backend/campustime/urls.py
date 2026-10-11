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


def health_check(request):
    """Public healthcheck probe for Render / container orchestrators."""
    return JsonResponse({
        'status': 'healthy',
        'service': 'campustime-api',
        'environment': 'development' if settings.DEBUG else 'production',
    })


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
