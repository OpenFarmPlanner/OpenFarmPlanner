from django.conf import settings
from django.urls import path

from farm.realtime.consumers import PublicCultureDiscussionConsumer
from notifications.consumers import NotificationConsumer

prefix = f'{settings.URL_PREFIX}/' if settings.URL_PREFIX else ''

websocket_urlpatterns = [
    path(
        f'{prefix}ws/public-cultures/<int:public_culture_id>/discussions/',
        PublicCultureDiscussionConsumer.as_asgi(),
    ),
    path(
        f'{prefix}ws/notifications/',
        NotificationConsumer.as_asgi(),
    ),
]
