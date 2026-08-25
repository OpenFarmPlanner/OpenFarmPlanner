from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .models import Notification
from .realtime import schedule_notification_update


@receiver([post_save, post_delete], sender=Notification)
def notification_changed(
    sender: type[Notification],
    instance: Notification,
    **kwargs: object,
) -> None:
    schedule_notification_update(instance.recipient_id, instance.id)
