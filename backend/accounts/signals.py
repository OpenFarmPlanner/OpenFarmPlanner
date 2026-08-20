from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

logger = logging.getLogger(__name__)
User = get_user_model()
_registration_notification_suppressed: ContextVar[bool] = ContextVar(
    'registration_notification_suppressed',
    default=False,
)


@contextmanager
def suppress_registration_notification() -> Iterator[None]:
    """Suppress the new-user email for a deliberately synthetic account."""
    token = _registration_notification_suppressed.set(True)
    try:
        yield
    finally:
        _registration_notification_suppressed.reset(token)


@receiver(post_save, sender=User, dispatch_uid='accounts.notify_admin_of_new_user')
def notify_admin_of_new_user(
    sender: type[User],
    instance: User,
    created: bool,
    **kwargs: object,
) -> None:
    """Notify the configured administrator without interrupting user creation."""
    del sender, kwargs
    recipient = settings.ADMIN_NOTIFICATION_EMAIL
    if not created or not recipient or _registration_notification_suppressed.get():
        return

    registered_at = timezone.localtime(instance.date_joined).isoformat()
    email_address = instance.email or '(not provided)'
    try:
        send_mail(
            subject=f'New OpenFarmPlanner user registered: {instance.username}',
            message=(
                'A new OpenFarmPlanner user has registered.\n\n'
                f'Username: {instance.username}\n'
                f'Email: {email_address}\n'
                f'Registration timestamp: {registered_at}\n'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            fail_silently=False,
        )
    except Exception:
        logger.exception(
            'Failed to send new user registration notification',
            extra={'user_id': instance.pk},
        )
