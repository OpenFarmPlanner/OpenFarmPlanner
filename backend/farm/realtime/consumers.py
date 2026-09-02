from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from crops import services as crop_services
from farm.models import PublicCrop

from .groups import public_crop_discussion_group


class PublicCropDiscussionConsumer(AsyncJsonWebsocketConsumer):
    """Deliver invalidations for one public-crop discussion resource."""

    public_crop_id: int
    group_name: str

    async def connect(self) -> None:
        user = self.scope['user']
        if not user.is_authenticated:
            await self.close(code=4401)
            return

        self.public_crop_id = self.scope['url_route']['kwargs']['public_crop_id']
        if not await self._may_access_resource(self.public_crop_id):
            await self.close(code=4403)
            return

        self.group_name = public_crop_discussion_group(self.public_crop_id)
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code: int) -> None:
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content: object, **kwargs: object) -> None:
        if isinstance(content, dict) and content.get('type') == 'ping':
            await self.send_json({'type': 'pong'})

    async def discussion_updated(self, event: dict[str, object]) -> None:
        await self.send_json({
            'type': 'discussion.updated',
            'public_crop_id': event['public_crop_id'],
            'discussion_id': event['discussion_id'],
        })

    @database_sync_to_async
    def _may_access_resource(self, public_crop_id: int) -> bool:
        # This mirrors the REST resource boundary: discussions are available
        # only for published, visible public-library entries.
        return PublicCrop.objects.filter(
            pk=public_crop_id,
            status=PublicCrop.STATUS_PUBLISHED,
        ).filter(crop_services.visible_public_crop_species_query()).exists()
