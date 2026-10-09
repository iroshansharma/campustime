from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FacultyViewSet, FacultySubjectQualificationViewSet,
    FacultyAvailabilityViewSet, SectionSubjectAssignmentViewSet
)

app_name = 'faculty'

router = DefaultRouter()
router.register(r'profiles', FacultyViewSet, basename='faculty-profile')
router.register(r'qualifications', FacultySubjectQualificationViewSet, basename='faculty-qualification')
router.register(r'availability', FacultyAvailabilityViewSet, basename='faculty-availability')
router.register(r'assignments', SectionSubjectAssignmentViewSet, basename='section-subject-assignment')

urlpatterns = [
    path('', include(router.urls)),
]
