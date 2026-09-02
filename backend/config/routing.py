from django.conf import settings
from django.urls import path

from farm.realtime.consumers import PublicCropDiscussionConsumer
from notifications.consumers import NotificationConsumer

prefix = f'{settings.URL_PREFIX}/' if settings.URL_PREFIX else ''

websocket_urlpatterns = [
    path(
        f'{prefix}ws/public-crops/<int:public_crop_id>/discussions/',
        PublicCropDiscussionConsumer.as_asgi(),
    ),
    path(
        f'{prefix}ws/notifications/',
        NotificationConsumer.as_asgi(),
    ),
]
