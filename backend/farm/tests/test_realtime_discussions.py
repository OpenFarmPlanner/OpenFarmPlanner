from asgiref.sync import async_to_sync, sync_to_async
from channels.testing import WebsocketCommunicator
from channels_redis.core import RedisChannelLayer
from django.contrib.auth import get_user_model
from django.test import Client, TransactionTestCase
from redis.exceptions import TimeoutError as RedisTimeoutError

from config.asgi import application
from farm.models import (
    PublicCulture,
    PublicCultureDiscussionComment,
    PublicCultureDiscussionTopic,
)
from farm.realtime.channel_layers import IdleTolerantRedisChannelLayer


def test_redis_channel_layer_treats_idle_timeout_as_empty_receive(monkeypatch) -> None:
    async def raise_idle_timeout(self, index: int, channel: str, timeout: int) -> bytes | None:
        raise RedisTimeoutError('Timeout reading from redis socket')

    monkeypatch.setattr(RedisChannelLayer, '_brpop_with_clean', raise_idle_timeout)
    layer = IdleTolerantRedisChannelLayer(hosts=[{'host': 'localhost', 'port': 6379}])

    result = async_to_sync(layer._brpop_with_clean)(0, 'asgitest-channel', 5)

    assert result is None


class DiscussionWebSocketTests(TransactionTestCase):
    def setUp(self) -> None:
        self.user = get_user_model().objects.create_user(
            username='realtime-user', password='test-password'
        )
        self.first_culture = PublicCulture.objects.create(
            name='Tomato', status=PublicCulture.STATUS_PUBLISHED, created_by=self.user
        )
        self.second_culture = PublicCulture.objects.create(
            name='Bean', status=PublicCulture.STATUS_PUBLISHED, created_by=self.user
        )
        client = Client()
        client.force_login(self.user)
        self.cookie_header = (
            b'cookie', f'sessionid={client.cookies["sessionid"].value}'.encode()
        )

    def test_authenticated_connection_receives_only_its_resource_updates(self) -> None:
        async_to_sync(self._assert_isolated_delivery)()

    async def _assert_isolated_delivery(self) -> None:
        first = self._communicator(self.first_culture.id, authenticated=True)
        second = self._communicator(self.second_culture.id, authenticated=True)
        self.assertTrue((await first.connect())[0])
        self.assertTrue((await second.connect())[0])

        unrelated_topic = await sync_to_async(PublicCultureDiscussionTopic.objects.create)(
            public_culture=self.second_culture,
            title='Unrelated',
            created_by=self.user,
        )
        await sync_to_async(PublicCultureDiscussionComment.objects.create)(
            topic=unrelated_topic, body='Not for the first subscriber', created_by=self.user
        )
        self.assertTrue(await first.receive_nothing(timeout=0.1))
        unrelated_event = await second.receive_json_from()
        self.assertEqual(unrelated_event['public_culture_id'], self.second_culture.id)
        # Topic creation and its first comment are distinct committed changes.
        await second.receive_json_from()

        topic = await sync_to_async(PublicCultureDiscussionTopic.objects.create)(
            public_culture=self.first_culture,
            title='Expected',
            created_by=self.user,
        )
        event = await first.receive_json_from()
        self.assertEqual(event, {
            'type': 'discussion.updated',
            'public_culture_id': self.first_culture.id,
            'discussion_id': topic.id,
        })
        self.assertTrue(await second.receive_nothing(timeout=0.1))
        await first.disconnect()
        await second.disconnect()

    def test_unauthenticated_connection_is_rejected(self) -> None:
        async_to_sync(self._assert_rejected)(self.first_culture.id, False)

    def test_unpublished_resource_is_rejected(self) -> None:
        hidden = PublicCulture.objects.create(name='Hidden', status='removed')
        async_to_sync(self._assert_rejected)(hidden.id, True)

    async def _assert_rejected(self, culture_id: int, authenticated: bool) -> None:
        communicator = self._communicator(culture_id, authenticated=authenticated)
        connected, close_code = await communicator.connect()
        self.assertFalse(connected)
        self.assertIn(close_code, {4401, 4403})

    def _communicator(
        self, culture_id: int, *, authenticated: bool
    ) -> WebsocketCommunicator:
        headers = [(b'host', b'localhost'), (b'origin', b'http://localhost')]
        if authenticated:
            headers.append(self.cookie_header)
        return WebsocketCommunicator(
            application,
            f'/ws/public-cultures/{culture_id}/discussions/',
            headers=headers,
        )
