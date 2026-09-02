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
    # Deprecated pre-"Crop" spelling. A deploy restarts the ASGI process while
    # browsers keep the JS bundle they already loaded, so a client from before
    # the rename still opens this path until it reloads.
    path(
        f'{prefix}ws/public-cultures/<int:public_crop_id>/discussions/',
        PublicCropDiscussionConsumer.as_asgi(),
    ),
    path(
        f'{prefix}ws/notifications/',
        NotificationConsumer.as_asgi(),
    ),
]
