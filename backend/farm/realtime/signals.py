from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from farm.models import PublicCultureDiscussionComment, PublicCultureDiscussionTopic

from .groups import public_culture_discussion_group


def broadcast_discussion_update(public_culture_id: int, discussion_id: int) -> None:
    """Publish a small invalidation after the surrounding write commits."""
    channel_layer = get_channel_layer()
    if channel_layer is None:
        return
    async_to_sync(channel_layer.group_send)(
        public_culture_discussion_group(public_culture_id),
        {
            'type': 'discussion.updated',
            'public_culture_id': public_culture_id,
            'discussion_id': discussion_id,
        },
    )


def _schedule(public_culture_id: int, discussion_id: int) -> None:
    transaction.on_commit(
        lambda: broadcast_discussion_update(public_culture_id, discussion_id)
    )


@receiver([post_save, post_delete], sender=PublicCultureDiscussionTopic)
def topic_changed(
    sender: type[PublicCultureDiscussionTopic],
    instance: PublicCultureDiscussionTopic,
    **kwargs: object,
) -> None:
    _schedule(instance.public_culture_id, instance.id)


@receiver([post_save, post_delete], sender=PublicCultureDiscussionComment)
def comment_changed(
    sender: type[PublicCultureDiscussionComment],
    instance: PublicCultureDiscussionComment,
    **kwargs: object,
) -> None:
    _schedule(instance.topic.public_culture_id, instance.topic_id)
