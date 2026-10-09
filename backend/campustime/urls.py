"""
CampusTime URL Configuration
Root routing pointing to /api/v1/ and admin site.
"""

from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView
)

urlpatterns = [
    path('admin/', admin.site.urls),

    # API v1 routes
    path('api/v1/auth/', include('apps.accounts.urls', namespace='accounts')),
    path('api/v1/academics/', include('apps.academics.urls', namespace='academics')),

    # API Documentation (OpenAPI 3 / Swagger / ReDoc)
    path('api/v1/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/v1/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/v1/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]
