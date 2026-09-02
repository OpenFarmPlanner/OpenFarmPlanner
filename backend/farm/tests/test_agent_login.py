from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone

from farm.models import AgentLoginToken, Location, Project, ProjectMembership


User = get_user_model()


@override_settings(AGENT_LOGIN_ENABLED=True, PUBLIC_FRONTEND_URL='https://app.example.test/openfarmplanner')
class AgentLoginTests(TestCase):
    def setUp(self) -> None:
        self.superuser = User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='pass12345',
        )
        self.member = User.objects.create_user(
            username='member',
            email='member@example.com',
            password='pass12345',
            is_active=True,
        )
        self.project = Project.objects.create(name='Project One', slug='project-one')
        self.other_project = Project.objects.create(name='Project Two', slug='project-two')

    def test_valid_token_without_expiry_logs_in_and_sets_agent_session(self) -> None:
        _, raw_token = AgentLoginToken.create_token(
            created_by=self.superuser,
            project=self.project,
        )

        response = self.client.get(f'/openfarmplanner/agent-login/{raw_token}/')

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, 'https://app.example.test/openfarmplanner/app/crops')

        token_obj = AgentLoginToken.objects.get(project=self.project)
        self.assertIsNotNone(token_obj.used_at)
        self.assertEqual(self.client.session.get('agent_mode'), True)
        self.assertEqual(self.client.session.get('agent_project_id'), self.project.id)
        self.assertEqual(str(self.client.session.get('_auth_user_id')), str(self.superuser.id))

    def test_expired_token_is_rejected_only_when_expiry_is_set(self) -> None:
        _, raw_token = AgentLoginToken.create_token(
            created_by=self.superuser,
            project=self.project,
            expires_at=timezone.now() - timedelta(minutes=1),
        )

        response = self.client.get(f'/openfarmplanner/agent-login/{raw_token}/')

        self.assertEqual(response.status_code, 400)
        self.assertIn('Token expired.', response.content.decode())

    def test_non_used_token_without_expiry_stays_valid_until_first_use(self) -> None:
        _, raw_token = AgentLoginToken.create_token(
            created_by=self.superuser,
            project=self.project,
        )

        token_obj = AgentLoginToken.objects.get(project=self.project)
        self.assertIsNone(token_obj.expires_at)
        self.assertIsNone(token_obj.used_at)
        self.assertTrue(token_obj.is_usable)

        response = self.client.get(f'/openfarmplanner/agent-login/{raw_token}/')
        self.assertEqual(response.status_code, 302)

    def test_previously_used_token_is_rejected(self) -> None:
        token_obj, raw_token = AgentLoginToken.create_token(
            created_by=self.superuser,
            project=self.project,
        )
        token_obj.used_at = timezone.now()
        token_obj.save(update_fields=['used_at'])

        response = self.client.get(f'/openfarmplanner/agent-login/{raw_token}/')

        self.assertEqual(response.status_code, 400)
        self.assertIn('Token already used.', response.content.decode())

    def test_non_superuser_cannot_create_token(self) -> None:
        with self.assertRaises(PermissionError):
            AgentLoginToken.create_token(
                created_by=self.member,
                project=self.project,
                expires_at=timezone.now() + timedelta(minutes=30),
            )

    def test_agent_session_is_strictly_bound_to_one_project(self) -> None:
        Location.objects.create(name='Scoped Location', project=self.project)
        Location.objects.create(name='Other Location', project=self.other_project)

        _, raw_token = AgentLoginToken.create_token(
            created_by=self.superuser,
            project=self.project,
        )
        self.client.get(f'/openfarmplanner/agent-login/{raw_token}/')

        scoped_response = self.client.get('/openfarmplanner/api/locations/')
        self.assertEqual(scoped_response.status_code, 200)
        self.assertEqual(scoped_response.data['count'], 1)
        self.assertEqual(scoped_response.data['results'][0]['name'], 'Scoped Location')

        denied_response = self.client.get('/openfarmplanner/api/locations/', HTTP_X_PROJECT_ID=str(self.other_project.id))
        self.assertEqual(denied_response.status_code, 403)

    def test_agent_session_remains_usable_after_token_consumption(self) -> None:
        Location.objects.create(name='Session Location', project=self.project)

        _, raw_token = AgentLoginToken.create_token(
            created_by=self.superuser,
            project=self.project,
        )
        consume_response = self.client.get(f'/openfarmplanner/agent-login/{raw_token}/')
        self.assertEqual(consume_response.status_code, 302)

        first_api_response = self.client.get('/openfarmplanner/api/locations/')
        second_api_response = self.client.get('/openfarmplanner/api/locations/')
        self.assertEqual(first_api_response.status_code, 200)
        self.assertEqual(second_api_response.status_code, 200)
        self.assertEqual(first_api_response.data['count'], 1)
        self.assertEqual(second_api_response.data['count'], 1)

    def test_same_token_cannot_be_used_multiple_times(self) -> None:
        _, raw_token = AgentLoginToken.create_token(
            created_by=self.superuser,
            project=self.project,
        )

        first_response = self.client.get(f'/openfarmplanner/agent-login/{raw_token}/')
        second_response = self.client.get(f'/openfarmplanner/agent-login/{raw_token}/')

        self.assertEqual(first_response.status_code, 302)
        self.assertEqual(second_response.status_code, 400)
        self.assertEqual(first_response.url, 'https://app.example.test/openfarmplanner/app/crops')
        self.assertIn('Token already used.', second_response.content.decode())

    def test_agent_session_reports_member_role_in_projects_bootstrap(self) -> None:
        ProjectMembership.objects.create(
            user=self.superuser,
            project=self.project,
            role=ProjectMembership.ROLE_ADMIN,
        )

        _, raw_token = AgentLoginToken.create_token(
            created_by=self.superuser,
            project=self.project,
        )
        consume_response = self.client.get(f'/openfarmplanner/agent-login/{raw_token}/')
        self.assertEqual(consume_response.status_code, 302)

        response = self.client.get('/openfarmplanner/api/projects-bootstrap/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['project']['id'], self.project.id)
        self.assertEqual(response.data[0]['role'], ProjectMembership.ROLE_MEMBER)

    def test_agent_session_cannot_use_project_admin_endpoints(self) -> None:
        ProjectMembership.objects.create(
            user=self.superuser,
            project=self.project,
            role=ProjectMembership.ROLE_ADMIN,
        )

        _, raw_token = AgentLoginToken.create_token(
            created_by=self.superuser,
            project=self.project,
        )
        consume_response = self.client.get(f'/openfarmplanner/agent-login/{raw_token}/')
        self.assertEqual(consume_response.status_code, 302)

        response = self.client.get(f'/openfarmplanner/api/projects/{self.project.id}/invitations/')
        self.assertEqual(response.status_code, 403)
        self.assertIn('member permissions', response.data.get('detail', '').lower())
