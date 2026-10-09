from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RoomViewSet, RoomAvailabilityViewSet

app_name = 'rooms'

router = DefaultRouter()
router.register(r'rooms', RoomViewSet, basename='room')
router.register(r'availability', RoomAvailabilityViewSet, basename='room-availability')

urlpatterns = [
    path('', include(router.urls)),
]
