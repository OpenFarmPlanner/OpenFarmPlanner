from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import AccountDeletionRequest
from accounts.services import finalize_account_deletion


class Command(BaseCommand):
    """Finalize scheduled account deletions by anonymizing personal data."""

    help = 'Finalize pending account deletions whose grace period has expired.'

    def handle(self, *args: tuple[str, ...], **options: Any) -> None:
        """
        Anonymize accounts whose deletion schedule has expired.

        :param args: Positional command arguments.
        :param options: Parsed command options.
        :return: None.
        """
        now = timezone.now()
        queryset = AccountDeletionRequest.objects.select_related('user').filter(
            deleted_at__isnull=True,
            scheduled_deletion_at__isnull=False,
            scheduled_deletion_at__lte=now,
        )

        processed = 0
        finalized_user_ids: list[int] = []
        for deletion in queryset.iterator():
            result = finalize_account_deletion(deletion=deletion, finalized_at=now)
            finalized_user_ids.append(result.user_id)
            processed += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'{now.isoformat()} Finalized {processed} accounts. user_ids={finalized_user_ids}'
            )
        )
