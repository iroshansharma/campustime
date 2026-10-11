from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from drf_spectacular.utils import extend_schema

from .serializers import CustomTokenObtainPairSerializer, UserSerializer


import logging
from rest_framework.exceptions import AuthenticationFailed, NotAuthenticated, ValidationError

logger = logging.getLogger('apps.accounts')


@extend_schema(tags=['Authentication'])
class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Obtains JWT access and refresh token pair along with institutional user profile.
    """
    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        try:
            return super().post(request, *args, **kwargs)
        except Exception as exc:
            if not isinstance(exc, (AuthenticationFailed, NotAuthenticated, ValidationError)):
                logger.error(
                    "Unexpected error during authentication: %s (%s)",
                    exc.__class__.__name__,
                    str(exc),
                    exc_info=True
                )
            raise


@extend_schema(tags=['Authentication'], responses={200: UserSerializer})
class UserProfileMeView(APIView):
    """
    Returns the authenticated user's profile, institutional role, and linked profiles.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)
