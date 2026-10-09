from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TimetableViewSet, TimetableEntryViewSet

app_name = 'timetables'

router = DefaultRouter()
router.register(r'entry-records', TimetableEntryViewSet, basename='timetable-entry-record')
router.register(r'', TimetableViewSet, basename='timetable')

urlpatterns = [
    path('', include(router.urls)),
]
