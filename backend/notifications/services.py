"""Creation helpers for in-app notifications.

Producers call :func:`create_notification` instead of writing ``Notification``
rows directly, so the "never notify an inactive/missing recipient" rule and the
context/target shape stay in one place.
"""
from __future__ import annotations

from typing import Any

from django.contrib.auth.models import AbstractBaseUser

from .models import Notification


def create_notification(
    *,
    recipient: AbstractBaseUser | None,
    notification_type: str,
    message: str,
    context: dict[str, Any] | None = None,
    target_type: str = '',
    target_id: int | None = None,
) -> Notification | None:
    """Store one notification, or return ``None`` when there is nobody to notify.

    ``message`` is the English fallback text (admin/API); the UI renders
    ``notification_type`` + ``context`` through its own translations.
    """
    if recipient is None or not getattr(recipient, 'is_active', True):
        return None
    return Notification.objects.create(
        recipient=recipient,
        notification_type=notification_type,
        message=message,
        context=context or {},
        target_type=target_type,
        target_id=target_id,
    )
