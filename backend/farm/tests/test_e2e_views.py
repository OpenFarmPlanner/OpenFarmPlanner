from django.contrib.auth import get_user_model
from django.test import TestCase

from farm.e2e_views import E2EInvitationFixtureView, E2E_PUBLIC_CROP_VARIETY_PREFIXES
from farm.models import Crop, Project, PublicCrop

User = get_user_model()


class E2EInvitationFixtureViewResetTest(TestCase):
    def test_reset_removes_public_crops_created_by_the_scenario(self) -> None:
        scenario = 'public-crop-library-cleanup'
        admin = User.objects.create_user(
            username=f'{scenario}-admin',
            email=f'{scenario}-admin@e2e.local',
            password='Pass12345!',
            is_active=True,
        )
        project = Project.objects.create(name='E2E Project', slug=scenario)
        crop = Crop.objects.create(
            name='Ackerbohne',
            variety=f'{E2E_PUBLIC_CROP_VARIETY_PREFIXES[0]}123',
            project=project,
        )
        public_crop = PublicCrop.objects.create(
            name='Ackerbohne',
            variety=f'{E2E_PUBLIC_CROP_VARIETY_PREFIXES[0]}123',
            status=PublicCrop.STATUS_PUBLISHED,
            created_by=admin,
            source_project=project,
            source_project_crop=crop,
        )
        orphaned_fixture_crop = PublicCrop.objects.create(
            name='Ackerbohne',
            variety=f'{E2E_PUBLIC_CROP_VARIETY_PREFIXES[1]}123',
            status=PublicCrop.STATUS_PUBLISHED,
            created_by=admin,
        )
        unrelated = PublicCrop.objects.create(
            name='Ackerbohne',
            variety=f'{E2E_PUBLIC_CROP_VARIETY_PREFIXES[0]}manual',
            status=PublicCrop.STATUS_PUBLISHED,
        )

        E2EInvitationFixtureView()._reset(scenario)

        self.assertFalse(PublicCrop.objects.filter(pk=public_crop.pk).exists())
        self.assertFalse(PublicCrop.objects.filter(pk=orphaned_fixture_crop.pk).exists())
        self.assertTrue(PublicCrop.objects.filter(pk=unrelated.pk).exists())
