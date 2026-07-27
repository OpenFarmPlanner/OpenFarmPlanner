from __future__ import annotations

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.guest_demo import delete_guest_demo_session
from accounts.models import GuestDemoSession


class Command(BaseCommand):
    help = 'Delete expired anonymous guest demo sessions and their project data.'

    def handle(self, *args: object, **options: object) -> None:
        expired_sessions = GuestDemoSession.objects.select_related('user').filter(expires_at__lte=timezone.now())
        deleted_count = 0
        for demo_session in expired_sessions.iterator():
            delete_guest_demo_session(demo_session)
            deleted_count += 1
        self.stdout.write(self.style.SUCCESS(f'Deleted {deleted_count} expired guest demo sessions.'))
