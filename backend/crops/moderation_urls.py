from rest_framework.routers import DefaultRouter

from .views import PublicLibraryModeratorRequestViewSet

router = DefaultRouter()
router.register(
    r'moderator-requests',
    PublicLibraryModeratorRequestViewSet,
    basename='public-library-moderator-request',
)

urlpatterns = router.urls
