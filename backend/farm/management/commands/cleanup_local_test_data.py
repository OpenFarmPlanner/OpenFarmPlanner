from __future__ import annotations

from django.core.management.base import BaseCommand, CommandParser

from farm.services.local_test_data_cleanup import (
    assert_local_cleanup_allowed,
    build_local_test_data_cleanup_plan,
    cleanup_local_test_data,
)


class Command(BaseCommand):
    help = 'Preview or delete local E2E/demo fixture data. Development settings only.'

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Delete the selected local fixture data. Without this flag the command only prints a dry-run preview.',
        )

    def handle(self, *args: object, **options: object) -> None:
        assert_local_cleanup_allowed()
        if options['confirm']:
            plan = cleanup_local_test_data()
            prefix = 'Deleted'
        else:
            plan = build_local_test_data_cleanup_plan()
            prefix = 'Would delete'

        self.stdout.write(
            self.style.SUCCESS(
                f'{prefix} {plan.project_count} projects, {plan.user_count} users, '
                f'{plan.guest_demo_session_count} guest demo sessions, and '
                f'{plan.public_culture_count} E2E public cultures.'
            )
        )
        if not options['confirm']:
            self.stdout.write('Run again with --confirm to delete these rows.')
