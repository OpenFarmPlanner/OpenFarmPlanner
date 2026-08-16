from __future__ import annotations

from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    """One notification as the bell dropdown renders it.

    ``message`` is the English fallback; ``notification_type`` + ``context``
    are what the UI actually localizes.
    """

    class Meta:
        model = Notification
        fields = [
            'id',
            'notification_type',
            'message',
            'context',
            'target_type',
            'target_id',
            'is_read',
            'created_at',
        ]
        read_only_fields = fields
