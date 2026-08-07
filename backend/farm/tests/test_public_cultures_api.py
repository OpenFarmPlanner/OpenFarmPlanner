"""API tests for the public culture library endpoints."""


from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase as DRFAPITestCase

from accounts.guest_demo import create_guest_demo_session
from accounts.models import DocumentConsent
from crops.models import CropSpecies, CropSpeciesTranslation
from crops.permissions import grant_public_library_moderator_access
from farm.models import (
    Culture,
    EntityRevision,
    Project,
    ProjectMembership,
    PublicCulture,
    PublicCultureChangeProposal,
    PublicCultureDiscussionComment,
    PublicCultureDiscussionTopic,
    PublicCultureRevision,
    PublicCultureStatusEvent,
    PublicCultureTranslation,
    SeedPackage,
)
from farm.tests.api_base import User


class PublicCultureLibraryApiTest(DRFAPITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='library-user', email='library@example.com', password='testpass', is_active=True)
        self.project = Project.objects.create(name='Library Project', slug='library-project')
        ProjectMembership.objects.create(user=self.user, project=self.project, role='admin')
        self.client.force_authenticate(user=self.user)
        self.client.defaults['HTTP_X_PROJECT_ID'] = str(self.project.id)
        self.species = CropSpecies.objects.create(name='Lettuce')
        self.culture = Culture.objects.create(
            name='Lettuce',
            variety='Bijella',
            crop_species=self.species,
            growth_duration_days=50,
            harvest_duration_days=20,
            notes='Project-local notes',
            project=self.project,
        )
        SeedPackage.objects.create(culture=self.culture, project=self.project, size_value='25.0', size_unit='g')

    def publish_current_culture(self):
        return self.client.post(
            f'/openfarmplanner/api/cultures/{self.culture.id}/publish-public/',
            {
                'accepted_public_library_terms': True,
                'crop_species_id': self.species.id,
                'original_language_code': 'en',
            },
            format='json',
        )

    def test_publish_project_culture_creates_separate_public_culture(self):
        response = self.publish_current_culture()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['operation'], 'created')
        # Publishing a variety also auto-creates the species-level general
        # entry, since none existed yet for this species.
        self.assertEqual(PublicCulture.objects.count(), 2)
        public_culture = PublicCulture.objects.get(variety='Bijella')
        self.assertEqual(public_culture.name, self.culture.name)
        self.assertEqual(public_culture.variety, self.culture.variety)
        self.assertEqual(public_culture.source_project_culture, self.culture)
        self.assertEqual(public_culture.crop_species, self.species)
        self.assertEqual(public_culture.original_language_code, 'en')
        self.assertEqual(public_culture.seed_packages[0]['size_value'], 25.0)
        self.assertEqual(response.data['duplicates'], [])
        general_public_culture = PublicCulture.objects.get(variety='')
        self.assertEqual(general_public_culture.crop_species, self.species)
        self.assertEqual(general_public_culture.growth_duration_days, 50)
        self.assertTrue(
            DocumentConsent.objects.filter(
                user=self.user,
                document=DocumentConsent.DOCUMENT_PUBLIC_LIBRARY,
            ).exists()
        )

    def test_publish_requires_public_library_contribution_terms(self):
        response = self.client.post(f'/openfarmplanner/api/cultures/{self.culture.id}/publish-public/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['code'], 'public_library_terms_required')
        self.assertEqual(PublicCulture.objects.count(), 0)

    def test_guest_demo_user_cannot_publish_to_public_library(self):
        demo_session = create_guest_demo_session()
        demo_culture = Culture.objects.filter(project=demo_session.project).first()
        self.client.force_authenticate(user=demo_session.user)
        self.client.defaults['HTTP_X_PROJECT_ID'] = str(demo_session.project_id)

        response = self.client.post(
            f'/openfarmplanner/api/cultures/{demo_culture.id}/publish-public/',
            {'accepted_public_library_terms': True},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'guest_demo_restricted')
        self.assertEqual(PublicCulture.objects.count(), 0)

    def test_publish_preview_reports_quality_gate_status(self):
        response = self.client.get(
            f'/openfarmplanner/api/cultures/{self.culture.id}/publish-public/preview/',
            {'crop_species_id': self.species.id, 'original_language_code': 'en'},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['can_publish'])
        self.assertEqual(response.data['crop_species']['name'], 'Lettuce')
        self.assertEqual(response.data['original_language_code'], 'en')
        self.assertEqual(response.data['missing_required_fields'], [])

    def test_publish_preview_blocks_missing_required_public_fields(self):
        self.culture.variety = ''
        self.culture.save()

        response = self.client.get(
            f'/openfarmplanner/api/cultures/{self.culture.id}/publish-public/preview/',
            {'crop_species_id': self.species.id, 'original_language_code': 'en'},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['can_publish'])
        self.assertEqual(response.data['missing_required_fields'][0]['field'], 'variety')

    def test_publish_as_general_crop_allows_empty_public_variety(self):
        response = self.client.post(
            f'/openfarmplanner/api/cultures/{self.culture.id}/publish-public/',
            {
                'accepted_public_library_terms': True,
                'crop_species_id': self.species.id,
                'original_language_code': 'en',
                'publish_as_general': True,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        public_culture = PublicCulture.objects.get()
        self.assertEqual(public_culture.name, self.culture.name)
        self.assertEqual(public_culture.variety, '')
        self.assertEqual(public_culture.crop_species, self.species)

    def test_publish_preview_as_general_crop_does_not_require_variety(self):
        self.culture.variety = ''
        self.culture.save()

        response = self.client.get(
            f'/openfarmplanner/api/cultures/{self.culture.id}/publish-public/preview/',
            {'crop_species_id': self.species.id, 'original_language_code': 'en', 'publish_as_general': 'true'},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['can_publish'])
        self.assertEqual(response.data['missing_required_fields'], [])

    def test_publish_preview_allows_update_of_owned_public_culture(self):
        public_culture = PublicCulture.objects.create(
            name=self.culture.name,
            variety=self.culture.variety,
            status=PublicCulture.STATUS_PUBLISHED,
            crop_species=self.species,
            created_by=self.user,
            source_project=self.project,
            source_project_culture=self.culture,
        )
        self.culture.source_public_culture = public_culture
        self.culture.source_public_version = public_culture.version
        self.culture.save(update_fields=['source_public_culture', 'source_public_version'])

        response = self.client.get(
            f'/openfarmplanner/api/cultures/{self.culture.id}/publish-public/preview/',
            {'crop_species_id': self.species.id, 'original_language_code': 'en'},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['can_publish'])
        self.assertEqual(response.data['duplicates'], [])

    def test_publish_rejects_duplicates_with_conflict_response(self):
        other_culture = Culture.objects.create(
            name='Lettuce',
            variety='Bijella',
            crop_species=self.species,
            project=self.project,
        )
        PublicCulture.objects.create(
            name='Lettuce',
            variety='Bijella',
            status='published',
            crop_species=self.species,
            created_by=self.user,
            source_project=self.project,
            source_project_culture=other_culture,
        )

        response = self.publish_current_culture()

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['code'], 'duplicate_public_culture')
        self.assertEqual(response.data['detail'], 'A similar public culture already exists.')
        self.assertEqual(len(response.data['duplicates']), 1)
        self.assertEqual(response.data['duplicates'][0]['name'], 'Lettuce')
        self.assertTrue(response.data['duplicates'][0]['is_mine'])
        self.assertEqual(response.data['normalized_identity']['name'], 'lettuce')
        self.assertEqual(response.data['normalized_identity']['variety'], 'bijella')
        self.assertEqual(PublicCulture.objects.count(), 1)

    def test_publish_conflict_response_flags_foreign_duplicates_as_not_mine(self):
        other_user = User.objects.create_user(username='foreign-owner', email='foreign@example.com', password='testpass', is_active=True)
        other_culture = Culture.objects.create(
            name='Lettuce',
            variety='Bijella',
            crop_species=self.species,
            project=self.project,
        )
        PublicCulture.objects.create(
            name='Lettuce',
            variety='Bijella',
            status='published',
            crop_species=self.species,
            created_by=other_user,
            source_project=self.project,
            source_project_culture=other_culture,
        )

        response = self.publish_current_culture()

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(len(response.data['duplicates']), 1)
        self.assertFalse(response.data['duplicates'][0]['is_mine'])

    def test_second_publish_updates_own_linked_public_culture_and_increments_version(self):
        first_publish = self.publish_current_culture()
        self.assertEqual(first_publish.status_code, status.HTTP_201_CREATED)
        public_culture_id = first_publish.data['public_culture']['id']

        self.culture.notes = 'Updated local notes'
        self.culture.save()

        second_publish = self.publish_current_culture()

        self.assertEqual(second_publish.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_publish.data['operation'], 'updated')
        self.assertEqual(second_publish.data['public_culture']['id'], public_culture_id)
        # variety entry (updated in place) + the general entry auto-created on first publish
        self.assertEqual(PublicCulture.objects.count(), 2)

        updated_public = PublicCulture.objects.get(id=public_culture_id)
        self.assertEqual(updated_public.version, 2)
        self.assertEqual(updated_public.notes, 'Updated local notes')

    def test_publish_updates_own_imported_public_culture(self):
        own_public = PublicCulture.objects.create(
            name='Carrot',
            variety='Mokum',
            status='published',
            crop_species=self.species,
            original_language_code='en',
            created_by=self.user,
            source_project=self.project,
            version=3,
        )
        self.culture.source_public_culture = own_public
        self.culture.name = 'Carrot'
        self.culture.variety = 'Mokum'
        self.culture.notes = 'Refined owner notes'
        self.culture.seed_supplier = 'Reinsaat'
        self.culture.save()

        response = self.publish_current_culture()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['operation'], 'updated')
        self.assertEqual(response.data['public_culture']['id'], own_public.id)

        own_public.refresh_from_db()
        self.assertEqual(own_public.version, 4)
        self.assertEqual(own_public.notes, 'Refined owner notes')

    def test_publish_does_not_update_foreign_source_public_culture(self):
        other_user = User.objects.create_user(username='other-owner', email='other@example.com', password='testpass', is_active=True)
        foreign_public = PublicCulture.objects.create(
            name='Lettuce',
            variety='Bijella',
            status='published',
            crop_species=self.species,
            created_by=other_user,
            source_project=self.project,
            source_project_culture=self.culture,
            version=5,
        )
        self.culture.source_public_culture = foreign_public
        self.culture.save()

        response = self.publish_current_culture()

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['code'], 'duplicate_public_culture')
        foreign_public.refresh_from_db()
        self.assertEqual(foreign_public.version, 5)
        self.assertEqual(PublicCulture.objects.count(), 1)

    def test_publish_rejects_duplicates_using_normalized_fields(self):
        PublicCulture.objects.create(
            name=' Lettuce ',
            variety='BIJELLA',
            status='published',
            crop_species=self.species,
            created_by=self.user,
            source_project=self.project,
        )
        self.culture.name = '  lettuce'
        self.culture.variety = 'bijella  '
        self.culture.save()

        response = self.publish_current_culture()

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(len(response.data['duplicates']), 1)
        self.assertEqual(PublicCulture.objects.count(), 1)

    def test_publish_allows_new_public_culture_for_different_normalized_identity(self):
        other_culture = Culture.objects.create(
            name='Lettuce',
            variety='Bijella',
            crop_species=self.species,
            project=self.project,
        )
        PublicCulture.objects.create(
            name='Lettuce',
            variety='Bijella',
            status='published',
            crop_species=self.species,
            created_by=self.user,
            source_project=self.project,
            source_project_culture=other_culture,
        )
        self.culture.variety = 'Other Variety'
        self.culture.save()

        response = self.publish_current_culture()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # existing 'Bijella' duplicate + new 'Other Variety' + auto-created general entry
        self.assertEqual(PublicCulture.objects.count(), 3)

    def test_publish_does_not_touch_an_existing_general_public_culture(self):
        existing_general = PublicCulture.objects.create(
            name='Lettuce',
            variety='',
            status='published',
            crop_species=self.species,
            created_by=self.user,
            growth_duration_days=99,
            harvest_duration_days=99,
        )

        response = self.publish_current_culture()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PublicCulture.objects.filter(variety='').count(), 1)
        existing_general.refresh_from_db()
        self.assertEqual(existing_general.growth_duration_days, 99)
        self.assertEqual(existing_general.version, 1)

    def test_publish_preview_reports_stale_general_crop_notice(self):
        general = PublicCulture.objects.create(
            name='Lettuce',
            variety='',
            status='published',
            crop_species=self.species,
            created_by=self.user,
            growth_duration_days=10,
            harvest_duration_days=10,
        )
        PublicCulture.objects.filter(pk=general.pk).update(updated_at=timezone.now() - timedelta(days=800))

        response = self.client.get(
            f'/openfarmplanner/api/cultures/{self.culture.id}/publish-public/preview/',
            {'crop_species_id': self.species.id, 'original_language_code': 'en'},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notice = response.data['general_crop_notice']
        self.assertIsNotNone(notice)
        self.assertEqual(notice['public_culture_id'], general.id)
        self.assertTrue(notice['is_stale'])
        self.assertFalse(notice['is_incomplete'])

    def test_publish_preview_reports_incomplete_general_crop_notice(self):
        general = PublicCulture.objects.create(
            name='Lettuce',
            variety='',
            status='published',
            crop_species=self.species,
            created_by=self.user,
            growth_duration_days=None,
            harvest_duration_days=None,
        )

        response = self.client.get(
            f'/openfarmplanner/api/cultures/{self.culture.id}/publish-public/preview/',
            {'crop_species_id': self.species.id, 'original_language_code': 'en'},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notice = response.data['general_crop_notice']
        self.assertIsNotNone(notice)
        self.assertEqual(notice['public_culture_id'], general.id)
        self.assertTrue(notice['is_incomplete'])
        self.assertFalse(notice['is_stale'])

    def test_publish_preview_reports_no_general_crop_notice_when_up_to_date(self):
        PublicCulture.objects.create(
            name='Lettuce',
            variety='',
            status='published',
            crop_species=self.species,
            created_by=self.user,
            growth_duration_days=50,
            harvest_duration_days=20,
        )

        response = self.client.get(
            f'/openfarmplanner/api/cultures/{self.culture.id}/publish-public/preview/',
            {'crop_species_id': self.species.id, 'original_language_code': 'en'},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data['general_crop_notice'])

    def test_publish_preview_reports_no_general_crop_notice_when_no_general_entry_exists(self):
        response = self.client.get(
            f'/openfarmplanner/api/cultures/{self.culture.id}/publish-public/preview/',
            {'crop_species_id': self.species.id, 'original_language_code': 'en'},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data['general_crop_notice'])

    def test_public_culture_list_filters_by_crop_species(self):
        other_species = CropSpecies.objects.create(name='Carrot')
        PublicCulture.objects.create(
            name='Lettuce', variety='Bijella', status='published',
            crop_species=self.species, created_by=self.user,
        )
        PublicCulture.objects.create(
            name='Carrot', variety='Mokum', status='published',
            crop_species=other_species, created_by=self.user,
        )

        response = self.client.get('/openfarmplanner/api/public-cultures/', {'crop_species': self.species.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [item['variety'] for item in response.data['results']]
        self.assertEqual(names, ['Bijella'])

    def test_import_public_culture_creates_project_local_copy(self):
        public_culture = PublicCulture.objects.create(
            name='Bean',
            variety='Canadian Wonder',
            status='published',
            created_by=self.user,
            growth_duration_days=70,
            harvest_duration_days=30,
            notes='Public notes',
            seed_packages=[{'size_value': 15.0, 'size_unit': 'g'}],
        )

        response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['operation'], 'created')
        imported = Culture.objects.get(id=response.data['culture']['id'])
        self.assertEqual(imported.project, self.project)
        self.assertEqual(imported.source_public_culture, public_culture)
        self.assertEqual(imported.origin_type, Culture.ORIGIN_IMPORTED)
        self.assertFalse(imported.is_modified_from_source)
        self.assertEqual(imported.seed_packages.count(), 1)
        self.assertEqual(float(imported.seed_packages.first().size_value), 15.0)

    def test_public_culture_list_shows_no_import_status_when_not_yet_imported(self):
        PublicCulture.objects.create(
            name='Bean', variety='Canadian Wonder', status='published', created_by=self.user,
        )

        response = self.client.get('/openfarmplanner/api/public-cultures/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        entry = next(row for row in response.data['results'] if row['name'] == 'Bean')
        self.assertIsNone(entry['project_import_status'])

    def test_public_culture_detail_shows_import_status_after_import(self):
        public_culture = PublicCulture.objects.create(
            name='Bean', variety='Canadian Wonder', status='published', created_by=self.user,
        )
        import_response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')
        imported_id = import_response.data['culture']['id']

        detail_response = self.client.get(f'/openfarmplanner/api/public-cultures/{public_culture.id}/')

        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data['project_import_status'], {
            'culture_id': imported_id,
            'culture_name': 'Bean (Canadian Wonder)',
            'is_modified_from_source': False,
        })

    def test_public_culture_import_status_flags_local_modification(self):
        public_culture = PublicCulture.objects.create(
            name='Bean', variety='Canadian Wonder', status='published', created_by=self.user,
            notes='Public notes',
        )
        import_response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')
        imported_id = import_response.data['culture']['id']
        Culture.objects.filter(id=imported_id).update(notes='Locally edited notes')
        imported = Culture.objects.get(id=imported_id)
        imported.notes = 'Locally edited again'
        imported.save()

        detail_response = self.client.get(f'/openfarmplanner/api/public-cultures/{public_culture.id}/')

        self.assertTrue(detail_response.data['project_import_status']['is_modified_from_source'])

    def test_public_culture_import_status_is_project_scoped(self):
        public_culture = PublicCulture.objects.create(
            name='Bean', variety='Canadian Wonder', status='published', created_by=self.user,
        )
        self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')

        other_project = Project.objects.create(name='Other Project', slug='other-project')
        ProjectMembership.objects.create(user=self.user, project=other_project, role='admin')
        self.client.defaults['HTTP_X_PROJECT_ID'] = str(other_project.id)

        detail_response = self.client.get(f'/openfarmplanner/api/public-cultures/{public_culture.id}/')

        self.assertIsNone(detail_response.data['project_import_status'])

    def test_import_public_culture_keeps_species_translation_link_and_serves_english_name(self):
        species = CropSpecies.objects.create(name='Localized Import Species 1')
        CropSpeciesTranslation.objects.create(species=species, language_code='de', common_name='Ackerbohne')
        CropSpeciesTranslation.objects.create(species=species, language_code='en', common_name='Broad bean')
        public_culture = PublicCulture.objects.create(
            name='Ackerbohne',
            variety='Hangdown',
            status='published',
            crop_species=species,
            created_by=self.user,
            notes='Deutsche Beschreibung',
            original_language_code='de',
        )
        PublicCultureTranslation.objects.create(
            public_culture=public_culture,
            language_code='de',
            description='Deutsche Beschreibung',
        )
        PublicCultureTranslation.objects.create(
            public_culture=public_culture,
            language_code='en',
            description='English description',
        )

        response = self.client.post(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/',
            {},
            format='json',
            HTTP_ACCEPT_LANGUAGE='en',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        imported = Culture.objects.select_related('crop_species', 'source_public_culture').get(id=response.data['culture']['id'])
        self.assertEqual(imported.name, 'Ackerbohne')
        self.assertEqual(imported.crop_species, species)
        self.assertEqual(imported.source_public_culture, public_culture)
        self.assertEqual(imported.crop_species.translations_by_language(), {
            'de': 'Ackerbohne',
            'en': 'Broad bean',
        })
        self.assertEqual(imported.source_public_culture.descriptions_by_language(), {
            'de': 'Deutsche Beschreibung',
            'en': 'English description',
        })
        self.assertEqual(response.data['culture']['culture_display_name'], 'Broad bean')
        self.assertEqual(response.data['culture']['culture_display_language_code'], 'en')
        self.assertEqual(response.data['culture']['crop_species_translations'], {
            'de': 'Ackerbohne',
            'en': 'Broad bean',
        })

        detail_response = self.client.get(
            f'/openfarmplanner/api/cultures/{imported.id}/',
            HTTP_ACCEPT_LANGUAGE='en',
        )

        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data['name'], 'Ackerbohne')
        self.assertEqual(detail_response.data['culture_display_name'], 'Broad bean')
        self.assertEqual(detail_response.data['culture_display_language_code'], 'en')

    def test_imported_culture_detail_serves_german_name_when_requested(self):
        species = CropSpecies.objects.create(name='Localized Import Species 2')
        CropSpeciesTranslation.objects.create(species=species, language_code='de', common_name='Ackerbohne')
        CropSpeciesTranslation.objects.create(species=species, language_code='en', common_name='Broad bean')
        public_culture = PublicCulture.objects.create(
            name='Ackerbohne',
            variety='Hangdown',
            status='published',
            crop_species=species,
            created_by=self.user,
            original_language_code='de',
        )
        import_response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')
        imported_id = import_response.data['culture']['id']

        detail_response = self.client.get(
            f'/openfarmplanner/api/cultures/{imported_id}/',
            HTTP_ACCEPT_LANGUAGE='de',
        )

        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data['culture_display_name'], 'Ackerbohne')
        self.assertEqual(detail_response.data['culture_display_language_code'], 'de')

    def test_imported_culture_detail_falls_back_when_requested_translation_is_missing(self):
        species = CropSpecies.objects.create(name='Localized Import Species 3')
        CropSpeciesTranslation.objects.create(species=species, language_code='de', common_name='Ackerbohne')
        public_culture = PublicCulture.objects.create(
            name='Ackerbohne',
            variety='Hangdown',
            status='published',
            crop_species=species,
            created_by=self.user,
            original_language_code='de',
        )
        import_response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')
        imported_id = import_response.data['culture']['id']

        detail_response = self.client.get(
            f'/openfarmplanner/api/cultures/{imported_id}/',
            HTTP_ACCEPT_LANGUAGE='en',
        )

        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data['culture_display_name'], 'Ackerbohne')
        self.assertEqual(detail_response.data['culture_display_language_code'], 'de')

    def test_editing_imported_culture_does_not_change_public_culture(self):
        public_culture = PublicCulture.objects.create(
            name='Carrot',
            variety='Mokum',
            status='published',
            created_by=self.user,
            growth_duration_days=90,
            harvest_duration_days=14,
        )
        import_response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')
        imported_id = import_response.data['culture']['id']

        detail_response = self.client.get(f'/openfarmplanner/api/cultures/{imported_id}/')
        payload = dict(detail_response.data)
        payload['growth_duration_days'] = 120
        payload['cultivation_types'] = ['pre_cultivation']
        payload['cultivation_type'] = 'pre_cultivation'
        payload['supplier'] = None
        payload['supplier_id'] = None
        payload.pop('image_file', None)

        update_response = self.client.put(
            f'/openfarmplanner/api/cultures/{imported_id}/',
            payload,
            format='json',
        )

        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        public_culture.refresh_from_db()
        imported = Culture.objects.get(id=imported_id)
        self.assertEqual(public_culture.growth_duration_days, 90)
        self.assertEqual(imported.growth_duration_days, 120)
        self.assertEqual(imported.origin_type, Culture.ORIGIN_IMPORTED)
        self.assertTrue(imported.is_modified_from_source)

    def test_editing_imported_culture_normalizes_long_origin_type_without_db_error(self):
        public_culture = PublicCulture.objects.create(
            name='Pepper',
            variety='Red Flame',
            status='published',
            created_by=self.user,
            growth_duration_days=85,
            harvest_duration_days=20,
        )
        import_response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')
        imported_id = import_response.data['culture']['id']

        detail_response = self.client.get(f'/openfarmplanner/api/cultures/{imported_id}/')
        payload = dict(detail_response.data)
        payload['notes'] = 'Changed locally'
        payload['cultivation_types'] = ['pre_cultivation']
        payload['cultivation_type'] = 'pre_cultivation'
        payload['origin_type'] = 'imported_from_public_library_template'
        payload['supplier'] = None
        payload['supplier_id'] = None
        payload.pop('image_file', None)

        update_response = self.client.put(f'/openfarmplanner/api/cultures/{imported_id}/', payload, format='json')

        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        imported = Culture.objects.get(id=imported_id)
        self.assertEqual(imported.origin_type, Culture.ORIGIN_IMPORTED)
        self.assertTrue(imported.is_modified_from_source)

    def test_editing_imported_culture_with_supplier_name_and_null_supplier_id_keeps_supplier_null(self):
        public_culture = PublicCulture.objects.create(
            name='Lettuce',
            variety='Bijella',
            status='published',
            created_by=self.user,
        )
        import_response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')
        imported_id = import_response.data['culture']['id']

        # Public cultures no longer carry supplier data, so seed this
        # pre-existing legacy text value directly to test that a PUT with an
        # explicit null supplier_id (and a supplier_name that is therefore
        # ignored) does not wipe it out.
        Culture.objects.filter(id=imported_id).update(seed_supplier='Reinsaat')

        detail_response = self.client.get(f'/openfarmplanner/api/cultures/{imported_id}/')
        payload = dict(detail_response.data)
        payload['notes'] = 'Local edit'
        payload['supplier_id'] = None
        payload['supplier_name'] = 'Reinsaat'
        payload['cultivation_types'] = ['pre_cultivation']
        payload['cultivation_type'] = 'pre_cultivation'
        payload.pop('image_file', None)

        update_response = self.client.put(f'/openfarmplanner/api/cultures/{imported_id}/', payload, format='json')

        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        imported = Culture.objects.get(id=imported_id)
        self.assertIsNone(imported.supplier_id)
        self.assertEqual(imported.seed_supplier, 'Reinsaat')

    def test_reimporting_an_unchanged_import_is_a_no_op(self):
        public_culture = PublicCulture.objects.create(
            name='Carrot',
            variety='Nantes',
            status='published',
            created_by=self.user,
            growth_duration_days=70,
        )
        first_response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')
        imported_id = first_response.data['culture']['id']
        revision_count_after_first_import = EntityRevision.objects.filter(entity_type='culture', object_id=imported_id).count()

        second_response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')

        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.data['operation'], 'unchanged')
        self.assertEqual(second_response.data['culture']['id'], imported_id)
        self.assertEqual(Culture.objects.filter(source_public_culture=public_culture).count(), 1)
        self.assertEqual(
            EntityRevision.objects.filter(entity_type='culture', object_id=imported_id).count(),
            revision_count_after_first_import,
        )

    def test_reimporting_after_library_update_with_no_local_changes_syncs_automatically(self):
        public_culture = PublicCulture.objects.create(
            name='Carrot',
            variety='Nantes',
            status='published',
            created_by=self.user,
            growth_duration_days=70,
        )
        first_response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')
        imported_id = first_response.data['culture']['id']
        revision_count_after_first_import = EntityRevision.objects.filter(entity_type='culture', object_id=imported_id).count()

        public_culture.growth_duration_days = 80
        public_culture.version = 2
        public_culture.save(update_fields=['growth_duration_days', 'version'])

        second_response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')

        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.data['operation'], 'updated')
        self.assertEqual(second_response.data['culture']['id'], imported_id)
        self.assertEqual(Culture.objects.filter(source_public_culture=public_culture).count(), 1)
        imported = Culture.objects.get(id=imported_id)
        self.assertEqual(imported.growth_duration_days, 80)
        self.assertEqual(imported.source_public_version, 2)
        self.assertFalse(imported.is_modified_from_source)
        self.assertEqual(
            EntityRevision.objects.filter(entity_type='culture', object_id=imported_id).count(),
            revision_count_after_first_import + 1,
        )

    def test_reimporting_with_local_changes_requires_confirmation(self):
        public_culture = PublicCulture.objects.create(
            name='Carrot',
            variety='Nantes',
            status='published',
            created_by=self.user,
            growth_duration_days=70,
        )
        first_response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')
        imported_id = first_response.data['culture']['id']
        imported = Culture.objects.get(id=imported_id)
        imported.notes = 'Local edit'
        imported.save()
        self.assertTrue(Culture.objects.get(id=imported_id).is_modified_from_source)

        response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['code'], 'import_requires_confirmation')
        self.assertEqual(response.data['existing_culture_id'], imported_id)
        self.assertEqual(Culture.objects.filter(source_public_culture=public_culture).count(), 1)

    def test_reimporting_with_mode_update_overwrites_local_changes(self):
        public_culture = PublicCulture.objects.create(
            name='Carrot',
            variety='Nantes',
            status='published',
            created_by=self.user,
            growth_duration_days=70,
        )
        first_response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')
        imported_id = first_response.data['culture']['id']
        imported = Culture.objects.get(id=imported_id)
        imported.notes = 'Local edit'
        imported.save()
        self.assertTrue(Culture.objects.get(id=imported_id).is_modified_from_source)

        response = self.client.post(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/',
            {'mode': 'update'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['operation'], 'updated')
        self.assertEqual(Culture.objects.filter(source_public_culture=public_culture).count(), 1)
        imported.refresh_from_db()
        self.assertEqual(imported.notes, public_culture.notes)
        self.assertFalse(imported.is_modified_from_source)

    def test_reimporting_with_mode_new_creates_a_uniquely_named_copy(self):
        public_culture = PublicCulture.objects.create(
            name='Carrot',
            variety='Nantes',
            status='published',
            created_by=self.user,
            growth_duration_days=70,
        )
        first_response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')
        imported_id = first_response.data['culture']['id']
        imported = Culture.objects.get(id=imported_id)
        imported.notes = 'Local edit'
        imported.save()

        response = self.client.post(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/',
            {'mode': 'new'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['operation'], 'created')
        new_culture_id = response.data['culture']['id']
        self.assertNotEqual(new_culture_id, imported_id)
        new_culture = Culture.objects.get(id=new_culture_id)
        self.assertEqual(new_culture.name, 'Carrot (2)')
        self.assertEqual(new_culture.variety, 'Nantes')
        self.assertEqual(Culture.objects.filter(source_public_culture=public_culture).count(), 2)
        # The original, locally-edited culture is untouched.
        imported.refresh_from_db()
        self.assertEqual(imported.notes, 'Local edit')

    def test_public_library_list_requires_authentication(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/openfarmplanner/api/public-cultures/')
        self.assertIn(response.status_code, {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN})

    def test_public_library_list_returns_matching_results(self):
        PublicCulture.objects.create(name='Tomato', variety='Roma', status='published', created_by=self.user)
        PublicCulture.objects.create(name='Bean', variety='Neckargold', status='published', created_by=self.user)

        response = self.client.get('/openfarmplanner/api/public-cultures/?q=Roma')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['name'], 'Tomato')

    def test_authenticated_user_can_create_topic_and_reply_on_public_culture(self):
        public_culture = PublicCulture.objects.create(name='Tomato', variety='Roma', status='published', created_by=self.user)

        create_response = self.client.post(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/discussion-topics/',
            {'title': 'Growth period', 'body': 'Works well under cover in spring.'},
            format='json',
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED, create_response.data)
        topic = PublicCultureDiscussionTopic.objects.get()
        first_comment = topic.comments.get()
        reply_response = self.client.post(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/discussion-topics/{topic.id}/comments/',
            {'body': 'Agreed.', 'parent': first_comment.id},
            format='json',
        )

        self.assertEqual(reply_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PublicCultureDiscussionComment.objects.count(), 2)
        self.assertEqual(reply_response.data['parent'], first_comment.id)

    def test_nested_discussion_replies_keep_their_exact_parent(self):
        public_culture = PublicCulture.objects.create(name='Tomato', variety='Roma', status='published', created_by=self.user)
        topic = PublicCultureDiscussionTopic.objects.create(public_culture=public_culture, title='Nested replies', created_by=self.user)
        comment_a = PublicCultureDiscussionComment.objects.create(topic=topic, body='A', created_by=self.user)

        response_b = self.client.post(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/discussion-topics/{topic.id}/comments/',
            {'body': 'B', 'parent': comment_a.id},
            format='json',
        )
        response_c = self.client.post(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/discussion-topics/{topic.id}/comments/',
            {'body': 'C', 'parent': response_b.data['id']},
            format='json',
        )
        response_d = self.client.post(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/discussion-topics/{topic.id}/comments/',
            {'body': 'D', 'parent': comment_a.id},
            format='json',
        )

        self.assertEqual(response_b.status_code, status.HTTP_201_CREATED, response_b.data)
        self.assertEqual(response_c.status_code, status.HTTP_201_CREATED, response_c.data)
        self.assertEqual(response_d.status_code, status.HTTP_201_CREATED, response_d.data)
        self.assertEqual(response_b.data['parent'], comment_a.id)
        self.assertEqual(response_c.data['parent'], response_b.data['id'])
        self.assertEqual(response_d.data['parent'], comment_a.id)

    def test_discussion_topics_include_activity_preview_and_are_sorted_by_activity(self):
        public_culture = PublicCulture.objects.create(name='Tomato', variety='Roma', status='published', created_by=self.user)
        older_topic = PublicCultureDiscussionTopic.objects.create(public_culture=public_culture, title='Older topic', created_by=self.user)
        newer_topic = PublicCultureDiscussionTopic.objects.create(public_culture=public_culture, title='Active topic', created_by=self.user)
        now = timezone.now()
        older_comment = PublicCultureDiscussionComment.objects.create(topic=older_topic, body='Older preview', created_by=self.user)
        first_newer_comment = PublicCultureDiscussionComment.objects.create(topic=newer_topic, body='First active comment', created_by=self.user)
        latest_newer_comment = PublicCultureDiscussionComment.objects.create(topic=newer_topic, body='Latest active preview', created_by=self.user)
        PublicCultureDiscussionComment.objects.filter(pk=older_comment.pk).update(created_at=now - timedelta(days=2))
        PublicCultureDiscussionComment.objects.filter(pk=first_newer_comment.pk).update(created_at=now - timedelta(days=1))
        PublicCultureDiscussionComment.objects.filter(pk=latest_newer_comment.pk).update(created_at=now)

        response = self.client.get(f'/openfarmplanner/api/public-cultures/{public_culture.id}/discussion-topics/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([topic['title'] for topic in response.data], ['Active topic', 'Older topic'])
        self.assertEqual(response.data[0]['comment_count'], 2)
        self.assertEqual(response.data[0]['last_comment_preview'], 'Latest active preview')
        self.assertIsNotNone(response.data[0]['last_activity_at'])

    def test_discussion_topics_hide_threads_without_visible_comments(self):
        public_culture = PublicCulture.objects.create(name='Tomato', variety='Roma', status='published', created_by=self.user)
        visible_topic = PublicCultureDiscussionTopic.objects.create(public_culture=public_culture, title='Visible topic', created_by=self.user)
        deleted_topic = PublicCultureDiscussionTopic.objects.create(public_culture=public_culture, title='Deleted topic', created_by=self.user)
        PublicCultureDiscussionComment.objects.create(topic=visible_topic, body='Still visible', created_by=self.user)
        PublicCultureDiscussionComment.objects.create(
            topic=deleted_topic,
            body='',
            created_by=self.user,
            deleted_at=timezone.now(),
            deleted_by=self.user,
        )

        response = self.client.get(f'/openfarmplanner/api/public-cultures/{public_culture.id}/discussion-topics/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([topic['title'] for topic in response.data], ['Visible topic'])
        self.assertEqual(response.data[0]['comment_count'], 1)

    def test_anonymous_user_can_read_but_cannot_create_discussions(self):
        public_culture = PublicCulture.objects.create(name='Tomato', variety='Roma', status='published', created_by=self.user)
        self.client.force_authenticate(user=None)
        list_response = self.client.get(f'/openfarmplanner/api/public-cultures/{public_culture.id}/discussion-topics/')
        create_response = self.client.post(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/discussion-topics/',
            {'title': 'Anonymous', 'body': 'Not allowed'},
            format='json',
        )
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertIn(create_response.status_code, {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN})

    def test_guest_demo_user_can_read_but_cannot_create_public_discussions(self):
        public_culture = PublicCulture.objects.create(name='Lettuce', variety='Bijella', status='published', created_by=self.user)
        demo_session = create_guest_demo_session()
        self.client.force_authenticate(user=demo_session.user)

        list_response = self.client.get(f'/openfarmplanner/api/public-cultures/{public_culture.id}/discussion-topics/')
        create_response = self.client.post(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/discussion-topics/',
            {'title': 'Demo topic', 'body': 'Demo text'},
            format='json',
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(create_response.data['code'], 'guest_demo_restricted')
        self.assertFalse(PublicCultureDiscussionTopic.objects.filter(public_culture=public_culture).exists())

    def test_comment_owner_can_edit_and_soft_delete_but_other_user_cannot(self):
        public_culture = PublicCulture.objects.create(name='Tomato', variety='Roma', status='published', created_by=self.user)
        topic = PublicCultureDiscussionTopic.objects.create(public_culture=public_culture, title='Spacing', created_by=self.user)
        root_comment = PublicCultureDiscussionComment.objects.create(topic=topic, body='Original root', created_by=self.user)
        comment = PublicCultureDiscussionComment.objects.create(topic=topic, parent=root_comment, body='Original reply', created_by=self.user)
        child_comment = PublicCultureDiscussionComment.objects.create(topic=topic, parent=comment, body='Reply child', created_by=self.user)
        other_user = User.objects.create_user(username='comment-other', password='testpass')
        self.client.force_authenticate(other_user)
        forbidden = self.client.patch(f'/openfarmplanner/api/public-cultures/{public_culture.id}/discussion-comments/{comment.id}/', {'body': 'Changed'}, format='json')
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)
        self.client.force_authenticate(self.user)
        edited = self.client.patch(f'/openfarmplanner/api/public-cultures/{public_culture.id}/discussion-comments/{comment.id}/', {'body': 'Changed'}, format='json')
        deleted = self.client.delete(f'/openfarmplanner/api/public-cultures/{public_culture.id}/discussion-comments/{comment.id}/')
        comment.refresh_from_db()
        self.assertEqual(edited.status_code, status.HTTP_200_OK)
        self.assertTrue(edited.data['is_edited'])
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertIsNotNone(comment.deleted_at)
        self.assertEqual(comment.body, '')
        list_response = self.client.get(f'/openfarmplanner/api/public-cultures/{public_culture.id}/discussion-topics/{topic.id}/comments/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        deleted_comment_payload = next(item for item in list_response.data if item['id'] == comment.id)
        self.assertEqual(deleted_comment_payload['deletion_kind'], 'author')
        child_comment.refresh_from_db()
        self.assertEqual(child_comment.parent_id, comment.id)

    def test_comment_owner_can_delete_root_discussion_post_without_visible_replies(self):
        public_culture = PublicCulture.objects.create(name='Tomato', variety='Roma', status='published', created_by=self.user)
        topic = PublicCultureDiscussionTopic.objects.create(public_culture=public_culture, title='Root delete', created_by=self.user)
        root_comment = PublicCultureDiscussionComment.objects.create(topic=topic, body='Root content', created_by=self.user)

        response = self.client.delete(f'/openfarmplanner/api/public-cultures/{public_culture.id}/discussion-comments/{root_comment.id}/')

        root_comment.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertIsNotNone(root_comment.deleted_at)
        self.assertEqual(root_comment.body, '')

        topics_response = self.client.get(f'/openfarmplanner/api/public-cultures/{public_culture.id}/discussion-topics/')
        self.assertEqual(topics_response.status_code, status.HTTP_200_OK)
        self.assertEqual(topics_response.data, [])

    def test_comment_owner_cannot_delete_root_discussion_post_with_visible_replies(self):
        public_culture = PublicCulture.objects.create(name='Tomato', variety='Roma', status='published', created_by=self.user)
        topic = PublicCultureDiscussionTopic.objects.create(public_culture=public_culture, title='Root guard', created_by=self.user)
        root_comment = PublicCultureDiscussionComment.objects.create(topic=topic, body='Root content', created_by=self.user)
        PublicCultureDiscussionComment.objects.create(topic=topic, parent=root_comment, body='Visible reply', created_by=self.user)

        response = self.client.delete(f'/openfarmplanner/api/public-cultures/{public_culture.id}/discussion-comments/{root_comment.id}/')

        root_comment.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['code'], 'visible_replies_exist')
        self.assertIsNone(root_comment.deleted_at)
        self.assertEqual(root_comment.body, 'Root content')

    def test_comment_owner_can_delete_root_discussion_post_when_replies_are_deleted(self):
        public_culture = PublicCulture.objects.create(name='Tomato', variety='Roma', status='published', created_by=self.user)
        topic = PublicCultureDiscussionTopic.objects.create(public_culture=public_culture, title='Deleted replies', created_by=self.user)
        root_comment = PublicCultureDiscussionComment.objects.create(topic=topic, body='Root content', created_by=self.user)
        deleted_reply = PublicCultureDiscussionComment.objects.create(
            topic=topic,
            parent=root_comment,
            body='',
            created_by=self.user,
            deleted_at=timezone.now(),
            deleted_by=self.user,
        )

        response = self.client.delete(f'/openfarmplanner/api/public-cultures/{public_culture.id}/discussion-comments/{root_comment.id}/')

        root_comment.refresh_from_db()
        deleted_reply.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertIsNotNone(root_comment.deleted_at)
        self.assertEqual(deleted_reply.parent_id, root_comment.id)

    def test_comment_permissions_mark_root_delete_unavailable_for_owner(self):
        public_culture = PublicCulture.objects.create(name='Tomato', variety='Roma', status='published', created_by=self.user)
        topic = PublicCultureDiscussionTopic.objects.create(public_culture=public_culture, title='Permissions', created_by=self.user)
        root_comment = PublicCultureDiscussionComment.objects.create(topic=topic, body='Root content', created_by=self.user)
        reply = PublicCultureDiscussionComment.objects.create(topic=topic, parent=root_comment, body='Reply content', created_by=self.user)

        response = self.client.get(f'/openfarmplanner/api/public-cultures/{public_culture.id}/discussion-topics/{topic.id}/comments/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        by_id = {comment['id']: comment for comment in response.data}
        self.assertTrue(by_id[root_comment.id]['can_edit'])
        self.assertFalse(by_id[root_comment.id]['can_delete'])
        self.assertEqual(by_id[root_comment.id]['delete_blocked_reason'], 'visible_replies')
        self.assertTrue(by_id[reply.id]['can_delete'])

    def test_topic_keeps_exact_revision_when_new_versions_are_created(self):
        public_culture = PublicCulture.objects.create(name='Tomato', variety='Roma', status='published', created_by=self.user, version=1)
        revision = PublicCultureRevision.objects.create(public_culture=public_culture, version=1, action='created', snapshot={})
        response = self.client.post(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/discussion-topics/',
            {'title': 'Version-specific question', 'body': 'About version one', 'revision': revision.id},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        public_culture.version = 2
        public_culture.save(update_fields=['version'])
        PublicCultureRevision.objects.create(public_culture=public_culture, version=2, action='updated', snapshot={})
        topic = PublicCultureDiscussionTopic.objects.get()
        self.assertEqual(topic.revision_id, revision.id)
        self.assertEqual(topic.revision.version, 1)

    def test_public_library_moderator_can_soft_delete_foreign_comment(self):
        public_culture = PublicCulture.objects.create(name='Tomato', variety='Roma', status='published', created_by=self.user)
        topic = PublicCultureDiscussionTopic.objects.create(public_culture=public_culture, title='Moderation', created_by=self.user)
        comment = PublicCultureDiscussionComment.objects.create(topic=topic, body='Problematic', created_by=self.user)
        moderator = User.objects.create_user(username='discussion-moderator', password='testpass')
        grant_public_library_moderator_access(moderator)
        self.client.force_authenticate(moderator)
        response = self.client.delete(f'/openfarmplanner/api/public-cultures/{public_culture.id}/discussion-comments/{comment.id}/')
        comment.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertIsNotNone(comment.deleted_at)
        list_response = self.client.get(f'/openfarmplanner/api/public-cultures/{public_culture.id}/discussion-topics/{topic.id}/comments/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data[0]['deletion_kind'], 'moderator')

    def test_public_library_moderator_can_soft_delete_root_discussion_post(self):
        public_culture = PublicCulture.objects.create(name='Tomato', variety='Roma', status='published', created_by=self.user)
        topic = PublicCultureDiscussionTopic.objects.create(public_culture=public_culture, title='Moderation root', created_by=self.user)
        root_comment = PublicCultureDiscussionComment.objects.create(topic=topic, body='Root content', created_by=self.user)
        reply = PublicCultureDiscussionComment.objects.create(topic=topic, parent=root_comment, body='Reply content', created_by=self.user)
        moderator = User.objects.create_user(username='discussion-root-moderator', password='testpass')
        grant_public_library_moderator_access(moderator)
        self.client.force_authenticate(moderator)

        response = self.client.delete(f'/openfarmplanner/api/public-cultures/{public_culture.id}/discussion-comments/{root_comment.id}/')

        root_comment.refresh_from_db()
        reply.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertIsNotNone(root_comment.deleted_at)
        self.assertEqual(root_comment.body, '')
        self.assertEqual(reply.parent_id, root_comment.id)
        list_response = self.client.get(f'/openfarmplanner/api/public-cultures/{public_culture.id}/discussion-topics/{topic.id}/comments/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        by_id = {comment['id']: comment for comment in list_response.data}
        self.assertEqual(by_id[root_comment.id]['deletion_kind'], 'moderator')
        self.assertEqual(by_id[reply.id]['parent'], root_comment.id)

    def test_unauthenticated_user_cannot_edit_public_culture(self):
        public_culture = PublicCulture.objects.create(name='Tomato', variety='Roma', status='published', created_by=self.user)
        self.client.force_authenticate(user=None)

        response = self.client.patch(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/',
            {'notes': 'Anonymous edit'},
            format='json',
        )

        self.assertIn(response.status_code, {status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN})
        public_culture.refresh_from_db()
        self.assertEqual(public_culture.notes, '')

    def test_authenticated_user_can_edit_foreign_public_culture_and_version_is_recorded(self):
        other_user = User.objects.create_user(username='foreign-author', email='foreign@example.com', password='testpass', is_active=True)
        public_culture = PublicCulture.objects.create(
            name='Tomato',
            variety='Roma',
            status='published',
            created_by=other_user,
            notes='Original notes',
            version=1,
        )

        response = self.client.patch(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/',
            {
                'base_version': 1,
                'notes': 'Community-improved notes',
                'growth_duration_days': 68,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        public_culture.refresh_from_db()
        self.assertEqual(public_culture.notes, 'Community-improved notes')
        self.assertEqual(public_culture.growth_duration_days, 68)
        self.assertEqual(public_culture.version, 2)
        revisions = list(PublicCultureRevision.objects.filter(public_culture=public_culture).order_by('version'))
        self.assertEqual([revision.version for revision in revisions], [1, 2])
        self.assertEqual(revisions[0].snapshot['notes'], 'Original notes')
        self.assertEqual(revisions[1].created_by, self.user)
        self.assertIn(
            {'field': 'notes', 'old_value': 'Original notes', 'new_value': 'Community-improved notes'},
            revisions[1].changed_fields,
        )

    def test_public_culture_direct_edit_rejects_identity_changes(self):
        public_culture = PublicCulture.objects.create(
            name='Tomato',
            variety='Roma',
            status='published',
            created_by=self.user,
            notes='Original notes',
            version=1,
        )

        response = self.client.patch(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/',
            {
                'base_version': 1,
                'name': 'Cherry tomato',
                'variety': 'Black Cherry',
                'notes': 'Edited notes',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        public_culture.refresh_from_db()
        self.assertEqual(public_culture.name, 'Tomato')
        self.assertEqual(public_culture.variety, 'Roma')
        self.assertEqual(public_culture.notes, 'Original notes')

    def test_public_culture_versions_endpoint_returns_author_time_and_diff(self):
        public_culture = PublicCulture.objects.create(
            name='Tomato',
            variety='Roma',
            status='published',
            created_by=self.user,
            notes='Original notes',
            version=1,
        )
        self.client.patch(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/',
            {'base_version': 1, 'notes': 'Updated notes'},
            format='json',
        )

        response = self.client.get(f'/openfarmplanner/api/public-cultures/{public_culture.id}/versions/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]['version'], 2)
        self.assertIsNotNone(response.data[0]['created_at'])
        self.assertEqual(response.data[0]['changed_fields'][0]['field'], 'notes')
        self.assertEqual(response.data[0]['changed_fields'][0]['old_value'], 'Original notes')
        self.assertEqual(response.data[0]['changed_fields'][0]['new_value'], 'Updated notes')

    def test_revert_creates_new_version_without_deleting_history(self):
        public_culture = PublicCulture.objects.create(
            name='Tomato',
            variety='Roma',
            status='published',
            created_by=self.user,
            notes='Version 1 notes',
            version=1,
        )
        edit_response = self.client.patch(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/',
            {'base_version': 1, 'notes': 'Version 2 notes'},
            format='json',
        )
        self.assertEqual(edit_response.status_code, status.HTTP_200_OK)

        revert_response = self.client.post(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/revert/',
            {'version': 1, 'base_version': 2},
            format='json',
        )

        self.assertEqual(revert_response.status_code, status.HTTP_200_OK)
        public_culture.refresh_from_db()
        self.assertEqual(public_culture.notes, 'Version 1 notes')
        self.assertEqual(public_culture.version, 3)
        revisions = PublicCultureRevision.objects.filter(public_culture=public_culture).order_by('version')
        self.assertEqual(revisions.count(), 3)
        self.assertEqual(revisions.last().action, PublicCultureRevision.ACTION_RESTORED)
        self.assertEqual(revisions.last().restored_from_version, 1)

    def test_public_culture_edit_and_revert_do_not_mutate_imported_project_culture(self):
        public_culture = PublicCulture.objects.create(
            name='Bean',
            variety='Neckargold',
            status='published',
            created_by=self.user,
            notes='Public v1',
            growth_duration_days=55,
        )
        import_response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')
        imported = Culture.objects.get(id=import_response.data['culture']['id'])

        self.client.patch(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/',
            {'base_version': 1, 'notes': 'Public v2', 'growth_duration_days': 60},
            format='json',
        )
        self.client.post(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/revert/',
            {'version': 1, 'base_version': 2},
            format='json',
        )

        imported.refresh_from_db()
        public_culture.refresh_from_db()
        self.assertEqual(public_culture.notes, 'Public v1')
        self.assertEqual(imported.notes, 'Public v1')
        self.assertEqual(imported.growth_duration_days, 55)
        self.assertEqual(imported.source_public_culture, public_culture)

    def test_authenticated_user_can_create_change_proposal_for_allowed_fields(self):
        public_culture = PublicCulture.objects.create(name='Tomato', variety='Roma', status='published', created_by=self.user)

        response = self.client.post(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/change-proposals/',
            {
                'summary': 'Add clearer cultivation notes',
                'proposed_data': {'notes': 'Prefers warm protected conditions.'},
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        proposal = PublicCultureChangeProposal.objects.get()
        self.assertEqual(proposal.status, PublicCultureChangeProposal.STATUS_PENDING)
        self.assertEqual(proposal.proposed_by, self.user)
        self.assertEqual(proposal.proposed_data['notes'], 'Prefers warm protected conditions.')

    def test_guest_demo_user_cannot_create_change_proposal(self):
        public_culture = PublicCulture.objects.create(name='Lettuce', variety='Bijella', status='published', created_by=self.user)
        demo_session = create_guest_demo_session()
        self.client.force_authenticate(user=demo_session.user)

        response = self.client.post(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/change-proposals/',
            {'summary': 'Demo proposal', 'proposed_data': {'notes': 'Demo edit'}},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'guest_demo_restricted')
        self.assertFalse(PublicCultureChangeProposal.objects.filter(public_culture=public_culture).exists())

    def test_change_proposal_rejects_unsupported_fields(self):
        public_culture = PublicCulture.objects.create(name='Tomato', variety='Roma', status='published', created_by=self.user)

        response = self.client.post(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/change-proposals/',
            {
                'summary': 'Rename entry',
                'proposed_data': {'name': 'Cherry tomato'},
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(PublicCultureChangeProposal.objects.count(), 0)

    def test_only_moderator_can_approve_change_proposal_and_public_culture_version_increments(self):
        moderator = User.objects.create_user(
            username='proposal-moderator',
            email='proposal-moderator@example.com',
            password='testpass',
            is_active=True,
        )
        grant_public_library_moderator_access(moderator)
        public_culture = PublicCulture.objects.create(
            name='Tomato',
            variety='Roma',
            status='published',
            created_by=self.user,
            notes='Old notes',
            version=1,
        )
        proposal = PublicCultureChangeProposal.objects.create(
            public_culture=public_culture,
            proposed_by=self.user,
            summary='Improve notes',
            proposed_data={'notes': 'Improved notes', 'growth_duration_days': 65},
        )

        forbidden_response = self.client.post(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/change-proposals/{proposal.id}/approve/',
            {},
            format='json',
        )
        self.client.force_authenticate(user=moderator)
        approved_response = self.client.post(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/change-proposals/{proposal.id}/approve/',
            {'review_note': 'Looks plausible.'},
            format='json',
        )

        self.assertEqual(forbidden_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(approved_response.status_code, status.HTTP_200_OK)
        public_culture.refresh_from_db()
        proposal.refresh_from_db()
        self.assertEqual(public_culture.notes, 'Improved notes')
        self.assertEqual(public_culture.growth_duration_days, 65)
        self.assertEqual(public_culture.version, 2)
        self.assertEqual(proposal.status, PublicCultureChangeProposal.STATUS_APPROVED)
        self.assertEqual(proposal.reviewed_by, moderator)

    def test_moderator_can_reject_change_proposal_without_changing_public_culture(self):
        moderator = User.objects.create_user(
            username='proposal-reject-moderator',
            email='proposal-reject-moderator@example.com',
            password='testpass',
            is_active=True,
        )
        grant_public_library_moderator_access(moderator)
        public_culture = PublicCulture.objects.create(
            name='Tomato',
            variety='Roma',
            status='published',
            created_by=self.user,
            notes='Original notes',
        )
        proposal = PublicCultureChangeProposal.objects.create(
            public_culture=public_culture,
            proposed_by=self.user,
            summary='Change notes',
            proposed_data={'notes': 'Rejected notes'},
        )
        self.client.force_authenticate(user=moderator)

        response = self.client.post(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/change-proposals/{proposal.id}/reject/',
            {'review_note': 'Needs sources.'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        public_culture.refresh_from_db()
        proposal.refresh_from_db()
        self.assertEqual(public_culture.notes, 'Original notes')
        self.assertEqual(proposal.status, PublicCultureChangeProposal.STATUS_REJECTED)
        self.assertEqual(proposal.review_note, 'Needs sources.')

    def test_import_requires_project_membership_header(self):
        public_culture = PublicCulture.objects.create(name='Kale', variety='Nero', status='published', created_by=self.user)
        del self.client.defaults['HTTP_X_PROJECT_ID']

        response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_contributor_can_remove_own_public_culture_without_changing_imported_project_copy(self):
        public_culture = PublicCulture.objects.create(
            name='Bean',
            variety='Canadian Wonder',
            status=PublicCulture.STATUS_PUBLISHED,
            created_by=self.user,
            growth_duration_days=70,
            harvest_duration_days=30,
        )
        import_response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/import/', {}, format='json')
        imported = Culture.objects.get(id=import_response.data['culture']['id'])

        response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/remove/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        public_culture.refresh_from_db()
        imported.refresh_from_db()
        self.assertEqual(public_culture.status, PublicCulture.STATUS_WITHDRAWN)
        self.assertEqual(imported.name, 'Bean')
        self.assertEqual(imported.source_public_culture, public_culture)
        self.assertTrue(PublicCultureStatusEvent.objects.filter(
            public_culture=public_culture,
            from_status=PublicCulture.STATUS_PUBLISHED,
            to_status=PublicCulture.STATUS_WITHDRAWN,
            created_by=self.user,
        ).exists())

        list_response = self.client.get('/openfarmplanner/api/public-cultures/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data['results'], [])

    def test_non_contributor_without_moderation_rights_cannot_remove_public_culture(self):
        other_user = User.objects.create_user(
            username='other-contributor',
            email='other-contributor@example.com',
            password='testpass',
            is_active=True,
        )
        public_culture = PublicCulture.objects.create(
            name='Bean',
            variety='Canadian Wonder',
            status=PublicCulture.STATUS_PUBLISHED,
            created_by=other_user,
        )

        response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/remove/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        public_culture.refresh_from_db()
        self.assertEqual(public_culture.status, PublicCulture.STATUS_PUBLISHED)

    def test_contributor_can_republish_a_culture_removed_from_the_library(self):
        public_culture = PublicCulture.objects.create(
            name='Lettuce',
            variety='Bijella',
            status=PublicCulture.STATUS_PUBLISHED,
            crop_species=self.species,
            original_language_code='en',
            created_by=self.user,
            source_project=self.project,
            source_project_culture=self.culture,
        )
        remove_response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/remove/', {}, format='json')
        self.assertEqual(remove_response.status_code, status.HTTP_200_OK)

        response = self.publish_current_culture()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['operation'], 'updated')
        self.assertEqual(response.data['public_culture']['id'], public_culture.id)
        public_culture.refresh_from_db()
        self.assertEqual(public_culture.status, PublicCulture.STATUS_PUBLISHED)
        self.assertEqual(public_culture.version, 2)

    def test_admin_can_remove_public_culture_with_reason(self):
        moderator = User.objects.create_user(
            username='moderator',
            email='moderator@example.com',
            password='testpass',
            is_active=True,
        )
        grant_public_library_moderator_access(moderator)
        self.client.force_authenticate(user=moderator)
        public_culture = PublicCulture.objects.create(
            name='Tomato',
            variety='Roma',
            status=PublicCulture.STATUS_PUBLISHED,
            created_by=self.user,
        )

        response = self.client.post(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/remove/',
            {'reason': PublicCulture.REMOVAL_REASON_DUPLICATE},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        public_culture.refresh_from_db()
        self.assertEqual(public_culture.status, PublicCulture.STATUS_REMOVED)
        self.assertEqual(public_culture.removal_reason, PublicCulture.REMOVAL_REASON_DUPLICATE)
        self.assertTrue(PublicCultureStatusEvent.objects.filter(
            public_culture=public_culture,
            to_status=PublicCulture.STATUS_REMOVED,
            reason=PublicCulture.REMOVAL_REASON_DUPLICATE,
            created_by=moderator,
        ).exists())

    def test_moderator_can_restore_a_removed_public_culture(self):
        moderator = User.objects.create_user(
            username='restore-moderator',
            email='restore-moderator@example.com',
            password='testpass',
            is_active=True,
        )
        grant_public_library_moderator_access(moderator)
        public_culture = PublicCulture.objects.create(
            name='Tomato',
            variety='Roma',
            status=PublicCulture.STATUS_REMOVED,
            removal_reason=PublicCulture.REMOVAL_REASON_DUPLICATE,
            created_by=self.user,
        )
        self.client.force_authenticate(user=moderator)

        response = self.client.post(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/restore/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        public_culture.refresh_from_db()
        self.assertEqual(public_culture.status, PublicCulture.STATUS_PUBLISHED)
        self.assertEqual(public_culture.removal_reason, '')
        self.assertTrue(PublicCultureStatusEvent.objects.filter(
            public_culture=public_culture,
            from_status=PublicCulture.STATUS_REMOVED,
            to_status=PublicCulture.STATUS_PUBLISHED,
            created_by=moderator,
        ).exists())

    def test_non_moderator_cannot_restore_a_removed_public_culture(self):
        public_culture = PublicCulture.objects.create(
            name='Tomato',
            variety='Roma',
            status=PublicCulture.STATUS_REMOVED,
            removal_reason=PublicCulture.REMOVAL_REASON_DUPLICATE,
            created_by=self.user,
        )

        response = self.client.post(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/restore/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        public_culture.refresh_from_db()
        self.assertEqual(public_culture.status, PublicCulture.STATUS_REMOVED)

    def test_removed_public_cultures_are_hidden_from_the_default_list(self):
        moderator = User.objects.create_user(
            username='list-restore-moderator',
            email='list-restore-moderator@example.com',
            password='testpass',
            is_active=True,
        )
        grant_public_library_moderator_access(moderator)
        PublicCulture.objects.create(
            name='Tomato',
            variety='Roma',
            status=PublicCulture.STATUS_REMOVED,
            created_by=self.user,
        )
        self.client.force_authenticate(user=moderator)

        default_response = self.client.get('/openfarmplanner/api/public-cultures/')
        self.assertEqual(default_response.status_code, status.HTTP_200_OK)
        self.assertEqual(default_response.data['results'], [])

        removed_response = self.client.get('/openfarmplanner/api/public-cultures/?status=removed')
        self.assertEqual(removed_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(removed_response.data['results']), 1)

    def test_non_moderator_cannot_list_removed_public_cultures(self):
        PublicCulture.objects.create(
            name='Tomato',
            variety='Roma',
            status=PublicCulture.STATUS_REMOVED,
            created_by=self.user,
        )

        response = self.client.get('/openfarmplanner/api/public-cultures/?status=removed')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['results'], [])

    def test_staff_culture_list_exposes_linked_public_culture_id_for_moderation(self):
        moderator = User.objects.create_user(
            username='list-moderator',
            email='list-moderator@example.com',
            password='testpass',
            is_active=True,
        )
        grant_public_library_moderator_access(moderator)
        ProjectMembership.objects.create(user=moderator, project=self.project, role='admin')
        public_culture = PublicCulture.objects.create(
            name='Lettuce',
            variety='Bijella',
            status=PublicCulture.STATUS_PUBLISHED,
            created_by=self.user,
            source_project=self.project,
            source_project_culture=self.culture,
        )
        self.culture.source_public_culture = public_culture
        self.culture.source_public_version = public_culture.version
        self.culture.save(update_fields=['source_public_culture', 'source_public_version'])
        self.client.force_authenticate(user=moderator)

        response = self.client.get('/openfarmplanner/api/cultures/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['results'][0]['owned_public_culture_id'], public_culture.id)
        self.assertEqual(response.data['results'][0]['owned_public_culture_role'], 'moderator')

    def test_contributor_culture_list_reports_the_contributor_role_for_their_public_entry(self):
        public_culture = PublicCulture.objects.create(
            name='Lettuce',
            variety='Bijella',
            status=PublicCulture.STATUS_PUBLISHED,
            created_by=self.user,
            source_project=self.project,
            source_project_culture=self.culture,
        )

        response = self.client.get('/openfarmplanner/api/cultures/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['results'][0]['owned_public_culture_id'], public_culture.id)
        self.assertEqual(response.data['results'][0]['owned_public_culture_role'], 'contributor')

    def test_culture_list_reports_no_public_library_role_without_a_linked_entry(self):
        response = self.client.get('/openfarmplanner/api/cultures/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data['results'][0]['owned_public_culture_id'])
        self.assertIsNone(response.data['results'][0]['owned_public_culture_role'])

    def test_moderator_removing_their_own_public_culture_withdraws_it_without_a_reason(self):
        moderator = User.objects.create_user(
            username='self-moderator',
            email='self-moderator@example.com',
            password='testpass',
            is_active=True,
        )
        grant_public_library_moderator_access(moderator)
        self.client.force_authenticate(user=moderator)
        public_culture = PublicCulture.objects.create(
            name='Tomato',
            variety='Roma',
            status=PublicCulture.STATUS_PUBLISHED,
            created_by=moderator,
        )

        response = self.client.post(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/remove/',
            {},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        public_culture.refresh_from_db()
        self.assertEqual(public_culture.status, PublicCulture.STATUS_WITHDRAWN)
        self.assertEqual(public_culture.removal_reason, '')

    def test_moderator_removing_a_foreign_public_culture_requires_a_reason(self):
        public_culture = PublicCulture.objects.create(
            name='Tomato',
            variety='Roma',
            status=PublicCulture.STATUS_PUBLISHED,
            created_by=self.user,
        )

        moderator = User.objects.create_user(
            username='moderator-missing-reason',
            email='moderator-missing@example.com',
            password='testpass',
            is_active=True,
        )
        grant_public_library_moderator_access(moderator)
        self.client.force_authenticate(user=moderator)
        missing_reason_response = self.client.post(
            f'/openfarmplanner/api/public-cultures/{public_culture.id}/remove/',
            {},
            format='json',
        )
        self.assertEqual(missing_reason_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(missing_reason_response.data['code'], 'removal_reason_required')

    def test_hard_delete_is_blocked_when_public_culture_has_imports_or_project_provenance(self):
        moderator = User.objects.create_user(
            username='delete-moderator',
            email='delete-moderator@example.com',
            password='testpass',
            is_active=True,
        )
        grant_public_library_moderator_access(moderator)
        self.client.force_authenticate(user=moderator)
        public_culture = PublicCulture.objects.create(
            name='Bean',
            variety='Canadian Wonder',
            status=PublicCulture.STATUS_PUBLISHED,
            created_by=self.user,
            source_project=self.project,
            source_project_culture=self.culture,
        )
        Culture.objects.create(
            name='Bean',
            variety='Canadian Wonder',
            project=self.project,
            source_public_culture=public_culture,
            source_public_version=1,
            origin_type=Culture.ORIGIN_IMPORTED,
        )

        response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/hard-delete/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(PublicCulture.objects.filter(id=public_culture.id).exists())

    def test_admin_can_hard_delete_orphan_public_culture(self):
        moderator = User.objects.create_user(
            username='orphan-delete-moderator',
            email='orphan-delete-moderator@example.com',
            password='testpass',
            is_active=True,
        )
        grant_public_library_moderator_access(moderator)
        self.client.force_authenticate(user=moderator)
        public_culture = PublicCulture.objects.create(
            name='Orphan',
            variety='Test',
            status=PublicCulture.STATUS_REMOVED,
            created_by=None,
        )

        response = self.client.post(f'/openfarmplanner/api/public-cultures/{public_culture.id}/hard-delete/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(PublicCulture.objects.filter(id=public_culture.id).exists())

    def test_default_destroy_route_is_blocked_for_non_moderators(self):
        public_culture = PublicCulture.objects.create(
            name='Radish',
            variety='Cherry Belle',
            status=PublicCulture.STATUS_PUBLISHED,
            created_by=None,
        )

        response = self.client.delete(f'/openfarmplanner/api/public-cultures/{public_culture.id}/')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(PublicCulture.objects.filter(id=public_culture.id).exists())

    def test_default_destroy_route_enforces_provenance_safety_for_moderators(self):
        moderator = User.objects.create_user(
            username='destroy-route-moderator',
            email='destroy-route-moderator@example.com',
            password='testpass',
            is_active=True,
        )
        grant_public_library_moderator_access(moderator)
        self.client.force_authenticate(user=moderator)
        public_culture = PublicCulture.objects.create(
            name='Bean',
            variety='Canadian Wonder',
            status=PublicCulture.STATUS_PUBLISHED,
            created_by=self.user,
            source_project=self.project,
            source_project_culture=self.culture,
        )
        Culture.objects.create(
            name='Bean',
            variety='Canadian Wonder',
            project=self.project,
            source_public_culture=public_culture,
            source_public_version=1,
            origin_type=Culture.ORIGIN_IMPORTED,
        )

        response = self.client.delete(f'/openfarmplanner/api/public-cultures/{public_culture.id}/')

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(PublicCulture.objects.filter(id=public_culture.id).exists())

    def test_default_destroy_route_permanently_deletes_orphan_culture_for_moderators(self):
        moderator = User.objects.create_user(
            username='destroy-route-orphan-moderator',
            email='destroy-route-orphan-moderator@example.com',
            password='testpass',
            is_active=True,
        )
        grant_public_library_moderator_access(moderator)
        self.client.force_authenticate(user=moderator)
        public_culture = PublicCulture.objects.create(
            name='Orphan',
            variety='DestroyRoute',
            status=PublicCulture.STATUS_PUBLISHED,
            created_by=None,
        )

        response = self.client.delete(f'/openfarmplanner/api/public-cultures/{public_culture.id}/')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(PublicCulture.objects.filter(id=public_culture.id).exists())
