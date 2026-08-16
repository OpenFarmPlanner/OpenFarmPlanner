"""Read/mark-read API for the signed-in user's own notifications.

Strictly self-scoped: the queryset filters on ``request.user`` and there is no
create endpoint — notifications are produced server-side by
``notifications.services.create_notification``.
"""
from __future__ import annotations

from rest_framework import mixins, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response

from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    def list(self, request: Request, *args, **kwargs) -> Response:
        """Newest first, with the unread count attached to the same payload.

        The bell needs both numbers on every app load; folding the count into
        the list response keeps that a single request instead of two.
        """
        response = super().list(request, *args, **kwargs)
        unread_count = self.get_queryset().filter(is_read=False).count()
        if isinstance(response.data, dict):
            response.data['unread_count'] = unread_count
        else:
            response.data = {'results': response.data, 'unread_count': unread_count}
        return response

    @action(detail=True, methods=['post'], url_path='read')
    def mark_read(self, request: Request, pk: str | None = None) -> Response:
        notification = self.get_object()
        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=['is_read'])
        return Response(self.get_serializer(notification).data)
