from django.contrib.auth import get_user_model
from django.test import TestCase

from farm.e2e_views import E2EInvitationFixtureView, E2E_PUBLIC_CULTURE_VARIETY_PREFIXES
from farm.models import Culture, Project, PublicCulture

User = get_user_model()


class E2EInvitationFixtureViewResetTest(TestCase):
    def test_reset_removes_public_cultures_created_by_the_scenario(self) -> None:
        scenario = 'public-crop-library-cleanup'
        admin = User.objects.create_user(
            username=f'{scenario}-admin',
            email=f'{scenario}-admin@e2e.local',
            password='Pass12345!',
            is_active=True,
        )
        project = Project.objects.create(name='E2E Project', slug=scenario)
        culture = Culture.objects.create(
            name='Ackerbohne',
            variety=f'{E2E_PUBLIC_CULTURE_VARIETY_PREFIXES[0]}123',
            project=project,
        )
        public_culture = PublicCulture.objects.create(
            name='Ackerbohne',
            variety=f'{E2E_PUBLIC_CULTURE_VARIETY_PREFIXES[0]}123',
            status=PublicCulture.STATUS_PUBLISHED,
            created_by=admin,
            source_project=project,
            source_project_culture=culture,
        )
        orphaned_fixture_culture = PublicCulture.objects.create(
            name='Ackerbohne',
            variety=f'{E2E_PUBLIC_CULTURE_VARIETY_PREFIXES[1]}123',
            status=PublicCulture.STATUS_PUBLISHED,
            created_by=admin,
        )
        unrelated = PublicCulture.objects.create(
            name='Ackerbohne',
            variety=f'{E2E_PUBLIC_CULTURE_VARIETY_PREFIXES[0]}manual',
            status=PublicCulture.STATUS_PUBLISHED,
        )

        E2EInvitationFixtureView()._reset(scenario)

        self.assertFalse(PublicCulture.objects.filter(pk=public_culture.pk).exists())
        self.assertFalse(PublicCulture.objects.filter(pk=orphaned_fixture_culture.pk).exists())
        self.assertTrue(PublicCulture.objects.filter(pk=unrelated.pk).exists())
