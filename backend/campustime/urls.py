"""
CampusTime URL Configuration
Root routing pointing to /api/v1/ and admin site.
"""

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    # API v1 routes will be mounted in Phase 3
    # path('api/v1/auth/', include('apps.accounts.urls')),
    # path('api/v1/academics/', include('apps.academics.urls')),
    # path('api/v1/faculty/', include('apps.faculty.urls')),
    # path('api/v1/rooms/', include('apps.rooms.urls')),
    # path('api/v1/timetables/', include('apps.timetables.urls')),
    # path('api/v1/audit/', include('apps.audit.urls')),
]
