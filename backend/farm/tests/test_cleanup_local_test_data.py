from __future__ import annotations

from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone

from accounts.models import GuestDemoSession
from farm.models import Project, ProjectMembership, PublicCulture
from farm.services.demo_project import DEMO_PROJECT_DESCRIPTION, DEMO_PROJECT_SLUG, DEMO_USER_EMAIL
from farm.services.hint_test_project import HINT_TEST_PROJECT_SLUG, HINT_TEST_USER_EMAIL

User = get_user_model()


@override_settings(DEBUG=True, DJANGO_ENV='development')
class CleanupLocalTestDataCommandTests(TestCase):
    def test_dry_run_reports_selected_fixture_rows_without_deleting(self) -> None:
        e2e_project, e2e_users = self._create_e2e_fixture()
        regular_project, regular_user = self._create_regular_rows()

        output = StringIO()
        call_command('cleanup_local_test_data', stdout=output)

        self.assertIn('Would delete 1 projects, 3 users', output.getvalue())
        self.assertTrue(Project.objects.filter(id=e2e_project.id).exists())
        self.assertTrue(Project.objects.filter(id=regular_project.id).exists())
        self.assertEqual(User.objects.filter(id__in=[user.id for user in e2e_users]).count(), 3)
        self.assertTrue(User.objects.filter(id=regular_user.id).exists())

    def test_confirm_deletes_only_known_local_fixture_rows(self) -> None:
        self._create_e2e_fixture()
        self._create_demo_fixture()
        self._create_hint_fixture()
        self._create_guest_demo_fixture()
        regular_project, regular_user = self._create_regular_rows()

        output = StringIO()
        call_command('cleanup_local_test_data', '--confirm', stdout=output)

        self.assertIn('Deleted 3 projects, 6 users, 1 guest demo sessions, and 1 E2E public cultures.', output.getvalue())
        self.assertTrue(Project.objects.filter(id=regular_project.id).exists())
        self.assertTrue(User.objects.filter(id=regular_user.id).exists())
        self.assertFalse(Project.objects.filter(name__startswith='E2E Project ').exists())
        self.assertFalse(Project.objects.filter(slug__in=[DEMO_PROJECT_SLUG, HINT_TEST_PROJECT_SLUG, 'guest-demo-cleanup']).exists())
        self.assertFalse(User.objects.filter(email__iendswith='@e2e.local').exists())
        self.assertFalse(User.objects.filter(email__in=[DEMO_USER_EMAIL, HINT_TEST_USER_EMAIL, 'demo-cleanup@example.invalid']).exists())
        self.assertFalse(PublicCulture.objects.exists())
        self.assertFalse(GuestDemoSession.objects.exists())

    def test_confirm_deletes_all_guest_demo_sessions_despite_cascading_deletes(self) -> None:
        # Regression test: cleanup_local_test_data() used to iterate
        # GuestDemoSession.objects.iterator() while the loop body cascade-deleted
        # rows from that same table, risking a skipped row under the open
        # cursor. Several sessions make that skip observable.
        sessions = [self._create_guest_demo_fixture(str(index)) for index in range(5)]

        output = StringIO()
        call_command('cleanup_local_test_data', '--confirm', stdout=output)

        self.assertFalse(GuestDemoSession.objects.filter(id__in=[session.id for session in sessions]).exists())

    @override_settings(DEBUG=True, DJANGO_ENV='test')
    def test_command_is_blocked_outside_development_settings(self) -> None:
        with self.assertRaisesMessage(RuntimeError, 'only allowed'):
            call_command('cleanup_local_test_data')

    def _create_e2e_fixture(self) -> tuple[Project, list]:
        project = Project.objects.create(name='E2E Project cleanup', slug='cleanup-e2e')
        users = [
            User.objects.create_user(
                username=f'cleanup-e2e-{role}',
                email=f'cleanup-e2e-{role}@e2e.local',
                password='pass12345',
            )
            for role in ('admin', 'invitee', 'outsider')
        ]
        ProjectMembership.objects.create(user=users[0], project=project, role=ProjectMembership.ROLE_ADMIN)
        PublicCulture.objects.create(
            created_by=users[0],
            source_project=project,
            name='E2E Test Culture',
            variety='E2E Kollaboration Cleanup',
        )
        return project, users

    def _create_demo_fixture(self) -> tuple[Project, object]:
        user = User.objects.create_user(
            username='openfarmplanner-demo',
            email=DEMO_USER_EMAIL,
            password='pass12345',
        )
        project = Project.objects.create(
            name='Solawi Sonnenacker',
            slug=DEMO_PROJECT_SLUG,
            description=DEMO_PROJECT_DESCRIPTION,
        )
        ProjectMembership.objects.create(user=user, project=project, role=ProjectMembership.ROLE_ADMIN)
        return project, user

    def _create_hint_fixture(self) -> tuple[Project, object]:
        user = User.objects.create_user(
            username='openfarmplanner-hint-test',
            email=HINT_TEST_USER_EMAIL,
            password='pass12345',
        )
        project = Project.objects.create(
            name='Hinweise & Sonderfaelle',
            slug=HINT_TEST_PROJECT_SLUG,
        )
        ProjectMembership.objects.create(user=user, project=project, role=ProjectMembership.ROLE_ADMIN)
        return project, user

    def _create_guest_demo_fixture(self, suffix: str = '') -> GuestDemoSession:
        user = User.objects.create_user(
            username=f'demo_cleanup{suffix}',
            email=f'demo-cleanup{suffix}@example.invalid',
            password=None,
        )
        project = Project.objects.create(name=f'Guest Demo{suffix}', slug=f'guest-demo-cleanup{suffix}')
        ProjectMembership.objects.create(user=user, project=project, role=ProjectMembership.ROLE_ADMIN)
        return GuestDemoSession.objects.create(
            user=user,
            project=project,
            expires_at=timezone.now(),
        )

    def _create_regular_rows(self) -> tuple[Project, object]:
        user = User.objects.create_user(
            username='real-user',
            email='real@example.com',
            password='pass12345',
        )
        project = Project.objects.create(name='Real Project', slug='real-project')
        ProjectMembership.objects.create(user=user, project=project, role=ProjectMembership.ROLE_ADMIN)
        return project, user
