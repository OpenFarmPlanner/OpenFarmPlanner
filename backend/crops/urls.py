from rest_framework.routers import DefaultRouter

from .views import CropViewSet

router = DefaultRouter()
router.register(r'', CropViewSet, basename='crop-library')

urlpatterns = router.urls
