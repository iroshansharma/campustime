from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CollegeViewSet, AcademicYearViewSet, ShiftViewSet,
    WorkingDayViewSet, PeriodSlotViewSet, DepartmentViewSet,
    SemesterViewSet, SectionViewSet, SubjectViewSet
)

app_name = 'academics'

router = DefaultRouter()
router.register(r'colleges', CollegeViewSet, basename='college')
router.register(r'academic-years', AcademicYearViewSet, basename='academic-year')
router.register(r'shifts', ShiftViewSet, basename='shift')
router.register(r'working-days', WorkingDayViewSet, basename='working-day')
router.register(r'period-slots', PeriodSlotViewSet, basename='period-slot')
router.register(r'departments', DepartmentViewSet, basename='department')
router.register(r'semesters', SemesterViewSet, basename='semester')
router.register(r'sections', SectionViewSet, basename='section')
router.register(r'subjects', SubjectViewSet, basename='subject')

urlpatterns = [
    path('', include(router.urls)),
]
