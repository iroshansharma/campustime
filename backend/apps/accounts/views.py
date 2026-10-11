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


import os
import secrets
from django.conf import settings
from django.contrib.auth import get_user_model


@extend_schema(tags=['Authentication'])
class AdminBootstrapView(APIView):
    """
    Secure one-time administrative endpoint to bootstrap or reset the admin account
    in headless cloud environments without interactive Shell access.

    Requires header 'X-Admin-Bootstrap-Key' compared against the secret
    environment variable ADMIN_BOOTSTRAP_SECRET using constant-time comparison.
    If ADMIN_BOOTSTRAP_SECRET is not configured or too short (<16 chars), this endpoint
    is completely dormant and returns HTTP 404 Not Found.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        expected_secret = getattr(settings, 'ADMIN_BOOTSTRAP_SECRET', '') or os.environ.get('ADMIN_BOOTSTRAP_SECRET', '')
        if not expected_secret or len(expected_secret.strip()) < 16:
            return Response(
                {'detail': 'Admin bootstrap endpoint is disabled.'},
                status=status.HTTP_404_NOT_FOUND
            )

        provided_key = request.headers.get('X-Admin-Bootstrap-Key') or request.META.get('HTTP_X_ADMIN_BOOTSTRAP_KEY', '')
        if not provided_key or not secrets.compare_digest(provided_key.strip(), expected_secret.strip()):
            return Response(
                {'detail': 'Forbidden: Invalid bootstrap key.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if not isinstance(request.data, dict):
            return Response(
                {'detail': 'Invalid JSON body. Expected a JSON object with username and password.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        username = (str(request.data.get('username') or 'admin')).strip()
        password = (str(request.data.get('password') or '')).strip()
        email = (str(request.data.get('email') or f'{username}@campustime.local')).strip()

        if not password or len(password) < 8:
            return Response(
                {'detail': 'Password is required and must be at least 8 characters long.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        User = get_user_model()
        user = User.objects.filter(username=username).first()

        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError

        try:
            validate_password(password, user=user)
        except DjangoValidationError as exc:
            return Response(
                {'detail': 'Password requirement error: ' + '; '.join(exc.messages)},
                status=status.HTTP_400_BAD_REQUEST
            )

        if user:
            user.set_password(password)
            user.role = User.Role.ADMIN
            user.is_staff = True
            user.is_superuser = True
            user.is_active = True
            user.is_verified = True
            if email and not User.objects.filter(email=email).exclude(pk=user.pk).exists():
                user.email = email
            user.save()
            message = f"Admin account '{username}' successfully updated."
        else:
            if User.objects.filter(email=email).exists():
                email = f"{username}_{secrets.token_hex(4)}@campustime.local"
            user = User.objects.create_superuser(
                username=username,
                email=email,
                password=password
            )
            user.role = User.Role.ADMIN
            user.is_active = True
            user.is_verified = True
            user.save()
            message = f"Admin account '{username}' successfully created."

        logger.info("Admin account '%s' configured successfully via secure administrative endpoint.", username)

        return Response(
            {
                'status': 'success',
                'username': username,
                'detail': message,
            },
            status=status.HTTP_200_OK
        )

