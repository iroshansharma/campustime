from rest_framework import viewsets, filters
from drf_spectacular.utils import extend_schema, extend_schema_view
from apps.accounts.permissions import IsAdminOrReadOnly
from .models import Room, RoomAvailability
from .serializers import RoomSerializer, RoomAvailabilitySerializer


@extend_schema_view(
    list=extend_schema(tags=['Rooms']),
    retrieve=extend_schema(tags=['Rooms']),
    create=extend_schema(tags=['Rooms']),
    update=extend_schema(tags=['Rooms']),
    destroy=extend_schema(tags=['Rooms']),
)
class RoomViewSet(viewsets.ModelViewSet):
    serializer_class = RoomSerializer
    permission_classes = [IsAdminOrReadOnly]
    search_fields = ['name', 'code', 'building']

    def get_queryset(self):
        qs = Room.objects.select_related('college', 'department').all().order_by('code')
        college_id = self.request.query_params.get('college')
        dept_id = self.request.query_params.get('department')
        room_type = self.request.query_params.get('room_type')
        min_capacity = self.request.query_params.get('min_capacity')
        is_active = self.request.query_params.get('is_active')

        if college_id:
            qs = qs.filter(college_id=college_id)
        if dept_id:
            qs = qs.filter(department_id=dept_id)
        if room_type:
            qs = qs.filter(room_type=room_type.upper())
        if min_capacity:
            try:
                qs = qs.filter(capacity__gte=int(min_capacity))
            except ValueError:
                pass
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ['true', '1'])
        return qs


@extend_schema_view(
    list=extend_schema(tags=['Room Availability']),
    retrieve=extend_schema(tags=['Room Availability']),
    create=extend_schema(tags=['Room Availability']),
    update=extend_schema(tags=['Room Availability']),
    destroy=extend_schema(tags=['Room Availability']),
)
class RoomAvailabilityViewSet(viewsets.ModelViewSet):
    serializer_class = RoomAvailabilitySerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        qs = RoomAvailability.objects.select_related('room', 'period_slot').all().order_by('room', 'period_slot')
        room_id = self.request.query_params.get('room')
        period_slot_id = self.request.query_params.get('period_slot')
        is_available = self.request.query_params.get('is_available')

        if room_id:
            qs = qs.filter(room_id=room_id)
        if period_slot_id:
            qs = qs.filter(period_slot_id=period_slot_id)
        if is_available is not None:
            qs = qs.filter(is_available=is_available.lower() in ['true', '1'])
        return qs
