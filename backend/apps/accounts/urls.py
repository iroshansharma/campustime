from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import CustomTokenObtainPairView, UserProfileMeView, AdminBootstrapView

app_name = 'accounts'

urlpatterns = [
    path('token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', UserProfileMeView.as_view(), name='user_me'),
    path('bootstrap-admin/', AdminBootstrapView.as_view(), name='bootstrap_admin'),
]
