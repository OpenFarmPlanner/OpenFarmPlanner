from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from farm.models import Location, Project, ProjectMembership
from farm.services.engagement_dashboard import ENGAGEMENT_MODELS, build_engagement_dashboard


class EngagementDashboardTests(TestCase):
    def setUp(self) -> None:
        self.superuser = get_user_model().objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='test-password',
        )
        self.member = get_user_model().objects.create_user(
            username='member',
            password='test-password',
            last_login=timezone.now(),
        )
        self.active_project = Project.objects.create(name='Active', slug='active')
        self.empty_project = Project.objects.create(name='Empty', slug='empty')
        ProjectMembership.objects.create(user=self.member, project=self.active_project)
        self.location = Location.objects.create(name='Farm', project=self.active_project)

    def test_service_aggregates_activity_without_project_query_growth(self) -> None:
        old_time = timezone.now() - timedelta(days=40)
        Location.objects.filter(pk=self.location.pk).update(created_at=old_time)
        recent_time = timezone.now() - timedelta(days=2)
        Location.objects.filter(pk=self.location.pk).update(updated_at=recent_time)

        with self.assertNumQueries(len(ENGAGEMENT_MODELS) + 4):
            dashboard = build_engagement_dashboard()

        projects_by_slug = {row.project.slug: row for row in dashboard.projects}
        active = projects_by_slug['active']
        empty = projects_by_slug['empty']
        self.assertEqual(active.project, self.active_project)
        self.assertEqual(active.last_active, recent_time)
        self.assertEqual(active.created_last_7_days, 0)
        self.assertEqual(active.created_last_30_days, 0)
        self.assertEqual(active.active_users_last_30_days, 1)
        self.assertEqual(active.status, 'Aktiv')
        self.assertEqual(empty.status, 'Nur registriert')
        self.assertEqual(dashboard.active_projects_7_days, 1)
        self.assertGreaterEqual(dashboard.total_projects, 2)
        self.assertEqual(dashboard.total_users, 2)

    def test_dashboard_is_available_to_superusers(self) -> None:
        self.client.force_login(self.superuser)

        response = self.client.get(reverse('admin:farm_project_engagement'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Nutzungsübersicht')
        self.assertContains(response, self.active_project.name)

    def test_dashboard_link_is_on_project_list_for_superusers(self) -> None:
        self.client.force_login(self.superuser)

        response = self.client.get(reverse('admin:farm_project_changelist'))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, reverse('admin:farm_project_engagement'))
        self.assertContains(response, 'Nutzungsübersicht')

    def test_dashboard_rejects_non_superusers(self) -> None:
        staff_user = get_user_model().objects.create_user(
            username='staff',
            password='test-password',
            is_staff=True,
        )
        self.client.force_login(staff_user)

        response = self.client.get(reverse('admin:farm_project_engagement'))

        self.assertEqual(response.status_code, 403)
