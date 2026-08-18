from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase as DRFAPITestCase

from accounts.guest_demo import create_guest_demo_session
from crops.models import CropSpecies, CropSpeciesTranslation, PublicLibraryModeratorRequest
from crops.permissions import grant_public_library_moderator_access
from farm.models import PublicCulture
from notifications.models import Notification

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

    def test_species_create_notifies_public_library_moderators(self):
        staff_moderator = User.objects.create_user(
            username='staff-moderator', email='staff-moderator@example.com', password='testpass',
            is_active=True, is_staff=True,
        )
        group_moderator = User.objects.create_user(
            username='group-moderator', email='group-moderator@example.com',
            password='testpass', is_active=True,
        )
        grant_public_library_moderator_access(group_moderator)
        self.client.force_authenticate(user=self.user)

        response = self.client.post('/openfarmplanner/api/crop-species/', {'name': 'Tree onion'})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        proposal = CropSpecies.objects.get(name='Tree onion')
        for recipient in (staff_moderator, group_moderator):
            notification = Notification.objects.get(recipient=recipient)
            self.assertEqual(
                notification.notification_type,
                Notification.TYPE_CROP_SPECIES_PROPOSAL_SUBMITTED,
            )
            self.assertEqual(notification.context, {'name': 'Tree onion'})
            self.assertEqual(
                notification.target_type,
                Notification.TARGET_PUBLIC_LIBRARY_MODERATION,
            )
            self.assertEqual(notification.target_id, proposal.id)
        # The proposer themselves is not a moderator here and gets nothing yet.
        self.assertFalse(Notification.objects.filter(recipient=self.user).exists())

    def test_species_create_does_not_notify_the_proposer_even_when_they_are_a_moderator(self):
        proposing_moderator = User.objects.create_user(
            username='proposing-moderator', email='proposing-moderator@example.com',
            password='testpass', is_active=True,
        )
        grant_public_library_moderator_access(proposing_moderator)
        other_moderator = User.objects.create_user(
            username='other-moderator', email='other-moderator@example.com',
            password='testpass', is_active=True,
        )
        grant_public_library_moderator_access(other_moderator)
        self.client.force_authenticate(user=proposing_moderator)

        response = self.client.post('/openfarmplanner/api/crop-species/', {'name': 'Self-proposed onion'})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(Notification.objects.filter(recipient=proposing_moderator).exists())
        self.assertTrue(Notification.objects.filter(recipient=other_moderator).exists())

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
        notification = Notification.objects.get(recipient=self.user)
        self.assertEqual(notification.notification_type, Notification.TYPE_CROP_SPECIES_PROPOSAL_ACCEPTED)
        self.assertEqual(notification.context, {'name': 'Tree onion'})
        # No published variety of the proposer under this species yet, so the
        # notification points at the species itself.
        self.assertEqual(notification.target_type, Notification.TARGET_CROP_SPECIES)
        self.assertEqual(notification.target_id, proposal.id)
        self.assertFalse(notification.is_read)

    def test_approving_a_proposal_links_the_notification_to_the_proposers_variety(self):
        moderator = User.objects.create_user(
            username='species-link-moderator',
            email='species-link-moderator@example.com',
            password='testpass',
            is_active=True,
        )
        grant_public_library_moderator_access(moderator)
        proposal = CropSpecies.objects.create(name='Tree onion', status=CropSpecies.STATUS_PROPOSED, proposed_by=self.user)
        published_variety = PublicCulture.objects.create(
            name='Tree onion', variety='Egyptian', status=PublicCulture.STATUS_PUBLISHED,
            version=1, created_by=self.user, crop_species=proposal,
        )
        self.client.force_authenticate(user=moderator)

        self.client.post(f'/openfarmplanner/api/crop-species/{proposal.id}/approve/', {}, format='json')

        notification = Notification.objects.get(recipient=self.user)
        self.assertEqual(notification.target_type, Notification.TARGET_PUBLIC_CULTURE)
        self.assertEqual(notification.target_id, published_variety.id)

    def test_reviewing_a_species_nobody_proposed_creates_no_notification(self):
        moderator = User.objects.create_user(
            username='species-seed-moderator',
            email='species-seed-moderator@example.com',
            password='testpass',
            is_active=True,
        )
        grant_public_library_moderator_access(moderator)
        proposal = CropSpecies.objects.create(name='Seeded species', status=CropSpecies.STATUS_PROPOSED)
        self.client.force_authenticate(user=moderator)

        response = self.client.post(f'/openfarmplanner/api/crop-species/{proposal.id}/approve/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Notification.objects.count(), 0)

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
        notification = Notification.objects.get(recipient=self.user)
        self.assertEqual(notification.notification_type, Notification.TYPE_CROP_SPECIES_PROPOSAL_REJECTED)
        self.assertEqual(notification.context, {'name': 'Tree onion'})

    def test_rejecting_a_proposal_removes_entries_already_published_under_it(self):
        moderator = User.objects.create_user(
            username='species-cleanup-moderator',
            email='species-cleanup-moderator@example.com',
            password='testpass',
            is_active=True,
        )
        grant_public_library_moderator_access(moderator)
        proposal = CropSpecies.objects.create(
            name='Karotsdasdas', status=CropSpecies.STATUS_PROPOSED, proposed_by=self.user,
        )
        general_entry = PublicCulture.objects.create(
            name='Karotte', variety='', status=PublicCulture.STATUS_PUBLISHED,
            version=1, created_by=self.user, crop_species=proposal,
        )
        variety_entry = PublicCulture.objects.create(
            name='Karotte', variety='Solveig', status=PublicCulture.STATUS_PUBLISHED,
            version=1, created_by=self.user, crop_species=proposal,
        )
        self.client.force_authenticate(user=moderator)

        response = self.client.post(f'/openfarmplanner/api/crop-species/{proposal.id}/reject/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        general_entry.refresh_from_db()
        variety_entry.refresh_from_db()
        for entry in (general_entry, variety_entry):
            self.assertEqual(entry.status, PublicCulture.STATUS_REMOVED)
            self.assertEqual(entry.removal_reason, PublicCulture.REMOVAL_REASON_SPECIES_REJECTED)
            self.assertEqual(entry.status_changed_by, moderator)
        # The species itself is unaffected beyond its own status; its name is
        # left as-is for the moderation log/history, only the entries move.
        proposal.refresh_from_db()
        self.assertEqual(proposal.status, CropSpecies.STATUS_REJECTED)

    def test_rejecting_a_proposal_leaves_other_statuses_under_it_untouched(self):
        moderator = User.objects.create_user(
            username='species-cleanup-moderator-2',
            email='species-cleanup-moderator-2@example.com',
            password='testpass',
            is_active=True,
        )
        grant_public_library_moderator_access(moderator)
        proposal = CropSpecies.objects.create(
            name='Karotsdasdas 2', status=CropSpecies.STATUS_PROPOSED, proposed_by=self.user,
        )
        withdrawn_entry = PublicCulture.objects.create(
            name='Karotte', variety='Withdrawn already', status=PublicCulture.STATUS_WITHDRAWN,
            version=1, created_by=self.user, crop_species=proposal,
        )
        self.client.force_authenticate(user=moderator)

        response = self.client.post(f'/openfarmplanner/api/crop-species/{proposal.id}/reject/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        withdrawn_entry.refresh_from_db()
        self.assertEqual(withdrawn_entry.status, PublicCulture.STATUS_WITHDRAWN)
        self.assertEqual(withdrawn_entry.removal_reason, '')

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

    def test_moderator_request_create_notifies_admins_only(self):
        admin = User.objects.create_user(
            username='request-admin', email='request-admin@example.com', password='testpass',
            is_active=True, is_staff=True,
        )
        plain_moderator = User.objects.create_user(
            username='plain-moderator', email='plain-moderator@example.com',
            password='testpass', is_active=True,
        )
        grant_public_library_moderator_access(plain_moderator)
        self.user.first_name = 'Ada'
        self.user.last_name = 'Lovelace'
        self.user.save()
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            '/openfarmplanner/api/public-library/moderator-requests/',
            {'motivation': 'I can help.'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        moderator_request = PublicLibraryModeratorRequest.objects.get(user=self.user)
        notification = Notification.objects.get(recipient=admin)
        self.assertEqual(
            notification.notification_type,
            Notification.TYPE_MODERATOR_REQUEST_SUBMITTED,
        )
        self.assertEqual(notification.context, {'name': 'Ada Lovelace'})
        self.assertEqual(notification.target_type, Notification.TARGET_PUBLIC_LIBRARY_MODERATION)
        self.assertEqual(notification.target_id, moderator_request.id)
        # A moderator without admin rights reviews species, not access requests.
        self.assertFalse(Notification.objects.filter(recipient=plain_moderator).exists())

    def test_admin_can_approve_moderator_request_without_staff_rights_for_user(self):
        admin = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='testpass',
            is_active=True,
            is_staff=True,
        )
        moderator_request = PublicLibraryModeratorRequest.objects.create(
            user=self.user, motivation='I can help.',
        )
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


class CropLibraryQueryCountTest(DRFAPITestCase):
    """Query-count regressions for the crop-library list endpoints.

    Both lists resolve a localized species name per row, so a missing prefetch
    turns into one query per result. The counts below must stay constant no
    matter how many rows the page holds — see
    `farm/tests/test_api_query_counts.py` for the same guard on the project
    API.
    """

    ROW_COUNT = 4

    def setUp(self):
        self.user = User.objects.create_user(
            username='crop-query-user', email='crop-query@example.com',
            password='testpass', is_active=True,
        )
        self.client.force_authenticate(user=self.user)
        for index in range(self.ROW_COUNT):
            species = CropSpecies.objects.create(name=f'Query count species {index}')
            CropSpeciesTranslation.objects.create(
                species=species, language_code='de', common_name=f'Art {index}',
            )
            CropSpeciesTranslation.objects.create(
                species=species, language_code='en', common_name=f'Species {index}',
            )
            PublicCulture.objects.create(
                name=f'Query count crop {index}', variety='Sorte', crop_species=species,
                status=PublicCulture.STATUS_PUBLISHED, version=1, created_by=self.user,
            )

    def test_crop_species_list_query_count(self):
        """`translations`, `display_name` and `display_language_code` all read
        the same prefetched translation rows."""
        with self.assertNumQueries(8):
            response = self.client.get('/openfarmplanner/api/crop-species/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data['results']), self.ROW_COUNT)

    def test_crops_list_query_count(self):
        """Published crops resolve a species name, a description and a
        contributor label per row."""
        with self.assertNumQueries(7):
            response = self.client.get('/openfarmplanner/api/crops/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data['results']), self.ROW_COUNT)

    def test_moderator_requests_list_query_count(self):
        moderator = User.objects.create_user(
            username='crop-query-admin', email='crop-query-admin@example.com',
            password='testpass', is_active=True, is_staff=True,
        )
        for index in range(self.ROW_COUNT):
            requester = User.objects.create_user(
                username=f'crop-query-requester-{index}',
                email=f'crop-query-requester-{index}@example.com',
                password='testpass',
                is_active=True,
            )
            PublicLibraryModeratorRequest.objects.create(user=requester, motivation='I can help.')
        self.client.force_authenticate(user=moderator)

        with self.assertNumQueries(4):
            response = self.client.get('/openfarmplanner/api/public-library/moderator-requests/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), self.ROW_COUNT)
