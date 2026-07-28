from rest_framework.routers import DefaultRouter

from .views import CropSpeciesViewSet

router = DefaultRouter()
router.register(r'', CropSpeciesViewSet, basename='crop-species')

urlpatterns = router.urls
