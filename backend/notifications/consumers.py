from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .realtime import user_notifications_group


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """Deliver notification invalidations to the authenticated recipient only."""

    group_name: str

    async def connect(self) -> None:
        user = self.scope['user']
        if not user.is_authenticated:
            await self.close(code=4401)
            return

        self.group_name = user_notifications_group(user.id)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code: int) -> None:
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content: object, **kwargs: object) -> None:
        if isinstance(content, dict) and content.get('type') == 'ping':
            await self.send_json({'type': 'pong'})

    async def notifications_updated(self, event: dict[str, object]) -> None:
        await self.send_json({
            'type': 'notifications.updated',
            'notification_id': event['notification_id'],
        })
