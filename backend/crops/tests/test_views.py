from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase as DRFAPITestCase

from accounts.guest_demo import create_guest_demo_session
from crops.models import CropSpecies, PublicLibraryModeratorRequest
from crops.permissions import grant_public_library_moderator_access
from farm.models import PublicCulture

User = get_user_model()


class CropViewSetTest(DRFAPITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='crops-user', email='crops@example.com', password='testpass', is_active=True,
        )
        self.published = PublicCulture.objects.create(
            name='Lettuce', variety='Bijella', status=PublicCulture.STATUS_PUBLISHED,
            version=1, created_by=self.user,
        )
        self.draft = PublicCulture.objects.create(
            name='Carrot', variety='Nantes', status='draft', version=1, created_by=self.user,
        )

    def test_requires_authentication(self):
        response = self.client.get('/openfarmplanner/api/crops/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_lists_only_published_crops(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/openfarmplanner/api/crops/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [item['name'] for item in response.data['results']]
        self.assertIn('Lettuce', names)
        self.assertNotIn('Carrot', names)

    def test_filters_by_free_text_query(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/openfarmplanner/api/crops/', {'q': 'lett'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['name'], 'Lettuce')

    def test_retrieves_a_single_published_crop(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(f'/openfarmplanner/api/crops/{self.published.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Lettuce')
        self.assertEqual(response.data['variety'], 'Bijella')
        # Provenance fields are project-scoped and must not leak into the
        # crop-library-facing serializer.
        self.assertNotIn('source_project', response.data)
        self.assertNotIn('source_project_culture', response.data)

    def test_retrieving_an_unpublished_crop_404s(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(f'/openfarmplanner/api/crops/{self.draft.id}/')

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_match_finds_an_exact_normalized_match(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/openfarmplanner/api/crops/match/', {'name': 'lettuce', 'variety': 'bijella'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['exists'])
        self.assertEqual(response.data['crop']['id'], self.published.id)

    def test_match_reports_no_match(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/openfarmplanner/api/crops/match/', {'name': 'Kohlrabi', 'variety': 'Superschmelz'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['exists'])
        self.assertIsNone(response.data['crop'])

    def test_write_methods_are_not_allowed(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/openfarmplanner/api/crops/', {'name': 'X', 'variety': 'Y'})

        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_lists_official_crop_species(self):
        CropSpecies.objects.create(name='Draft species', status=CropSpecies.STATUS_PROPOSED)
        self.client.force_authenticate(user=self.user)

        response = self.client.get('/openfarmplanner/api/crop-species/', {'q': 'tom'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [item['name'] for item in response.data['results']]
        self.assertEqual(names, ['Tomate'])
        self.assertNotIn('Draft species', names)

    def test_species_search_finds_plural_english_bean_query(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get('/openfarmplanner/api/crop-species/', {'q': 'beans'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = {item['name'] for item in response.data['results']}
        self.assertIn('Bohne', names)
        self.assertIn('Ackerbohne', names)
        self.assertIn('Buschbohne', names)
        self.assertIn('Stangenbohne', names)

    def test_species_create_stores_a_proposal(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post('/openfarmplanner/api/crop-species/', {'name': 'Tree onion'})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], CropSpecies.STATUS_PROPOSED)
        proposal = CropSpecies.objects.get(name='Tree onion')
        self.assertEqual(proposal.proposed_by, self.user)

    def test_guest_demo_user_cannot_create_species_proposal(self):
        demo_session = create_guest_demo_session()
        self.client.force_authenticate(user=demo_session.user)

        response = self.client.post('/openfarmplanner/api/crop-species/', {'name': 'Demo species'})

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'guest_demo_restricted')
        self.assertFalse(CropSpecies.objects.filter(name='Demo species').exists())

    def test_normal_user_cannot_list_or_review_species_proposals(self):
        proposal = CropSpecies.objects.create(name='Tree onion', status=CropSpecies.STATUS_PROPOSED, proposed_by=self.user)
        self.client.force_authenticate(user=self.user)

        list_response = self.client.get('/openfarmplanner/api/crop-species/', {'include_proposed': 'true'})
        status_filter_response = self.client.get('/openfarmplanner/api/crop-species/', {'status': CropSpecies.STATUS_PROPOSED})
        approve_response = self.client.post(f'/openfarmplanner/api/crop-species/{proposal.id}/approve/', {}, format='json')

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertNotIn('Tree onion', [item['name'] for item in list_response.data['results']])
        self.assertNotIn('Tree onion', [item['name'] for item in status_filter_response.data['results']])
        self.assertEqual(approve_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_moderator_can_approve_species_proposal(self):
        moderator = User.objects.create_user(
            username='species-moderator',
            email='species-moderator@example.com',
            password='testpass',
            is_active=True,
        )
        grant_public_library_moderator_access(moderator)
        proposal = CropSpecies.objects.create(name='Tree onion', status=CropSpecies.STATUS_PROPOSED, proposed_by=self.user)
        self.client.force_authenticate(user=moderator)

        response = self.client.post(f'/openfarmplanner/api/crop-species/{proposal.id}/approve/', {'review_note': 'Good addition.'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        proposal.refresh_from_db()
        self.assertEqual(proposal.status, CropSpecies.STATUS_PUBLISHED)
        self.assertEqual(proposal.reviewed_by, moderator)
        self.assertEqual(proposal.review_note, 'Good addition.')

    def test_moderator_can_reject_species_proposal(self):
        moderator = User.objects.create_user(
            username='species-reject-moderator',
            email='species-reject-moderator@example.com',
            password='testpass',
            is_active=True,
        )
        grant_public_library_moderator_access(moderator)
        proposal = CropSpecies.objects.create(name='Tree onion', status=CropSpecies.STATUS_PROPOSED, proposed_by=self.user)
        self.client.force_authenticate(user=moderator)

        response = self.client.post(f'/openfarmplanner/api/crop-species/{proposal.id}/reject/', {'review_note': 'Duplicate common name.'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        proposal.refresh_from_db()
        self.assertEqual(proposal.status, CropSpecies.STATUS_REJECTED)
        self.assertEqual(proposal.review_note, 'Duplicate common name.')

    def test_normal_user_cannot_edit_or_delete_published_species(self):
        species = CropSpecies.objects.create(name='Purple Sprouting Broccoli', status=CropSpecies.STATUS_PUBLISHED)
        self.client.force_authenticate(user=self.user)

        update_response = self.client.patch(f'/openfarmplanner/api/crop-species/{species.id}/', {'name': 'Hacked'}, format='json')
        delete_response = self.client.delete(f'/openfarmplanner/api/crop-species/{species.id}/')

        self.assertEqual(update_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(delete_response.status_code, status.HTTP_403_FORBIDDEN)
        species.refresh_from_db()
        self.assertEqual(species.name, 'Purple Sprouting Broccoli')

    def test_moderator_can_edit_and_delete_published_species(self):
        moderator = User.objects.create_user(
            username='species-edit-moderator',
            email='species-edit-moderator@example.com',
            password='testpass',
            is_active=True,
        )
        grant_public_library_moderator_access(moderator)
        species = CropSpecies.objects.create(name='Purple Sprouting Broccoli', status=CropSpecies.STATUS_PUBLISHED)
        self.client.force_authenticate(user=moderator)

        update_response = self.client.patch(f'/openfarmplanner/api/crop-species/{species.id}/', {'name': 'Purple Sprouting Broccoli (renamed)'}, format='json')
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        species.refresh_from_db()
        self.assertEqual(species.name, 'Purple Sprouting Broccoli (renamed)')

        delete_response = self.client.delete(f'/openfarmplanner/api/crop-species/{species.id}/')
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(CropSpecies.objects.filter(id=species.id).exists())

    def test_user_can_request_moderator_access_once(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post('/openfarmplanner/api/public-library/moderator-requests/', {'motivation': 'I can help.'}, format='json')
        duplicate_response = self.client.post('/openfarmplanner/api/public-library/moderator-requests/', {'motivation': 'Still can help.'}, format='json')
        mine_response = self.client.get('/openfarmplanner/api/public-library/moderator-requests/mine/')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(duplicate_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(mine_response.data['is_moderator'])
        self.assertEqual(mine_response.data['request']['status'], PublicLibraryModeratorRequest.STATUS_PENDING)

    def test_guest_demo_user_cannot_request_moderator_access(self):
        demo_session = create_guest_demo_session()
        self.client.force_authenticate(user=demo_session.user)

        response = self.client.post(
            '/openfarmplanner/api/public-library/moderator-requests/',
            {'motivation': 'Demo request'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'guest_demo_restricted')
        self.assertFalse(PublicLibraryModeratorRequest.objects.filter(user=demo_session.user).exists())

    def test_admin_can_approve_moderator_request_without_staff_rights_for_user(self):
        admin = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='testpass',
            is_active=True,
            is_staff=True,
        )
        moderator_request = PublicLibraryModeratorRequest.objects.create(user=self.user, motivation='I can help.')
        self.client.force_authenticate(user=admin)

        response = self.client.post(
            f'/openfarmplanner/api/public-library/moderator-requests/{moderator_request.id}/approve/',
            {'review_note': 'Welcome.'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        moderator_request.refresh_from_db()
        self.user.refresh_from_db()
        self.assertEqual(moderator_request.status, PublicLibraryModeratorRequest.STATUS_APPROVED)
        self.assertTrue(self.user.has_perm('crops.moderate_crop_species'))
        self.assertFalse(self.user.is_staff)
