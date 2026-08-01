"""API tests for the supplier endpoints."""


from rest_framework import status

from farm.models import (
    Project,
    ProjectMembership,
    Supplier,
)
from farm.tests.api_base import ProjectApiTestCase


class SupplierApiTest(ProjectApiTestCase):
    def test_supplier_list(self):
        """Test listing suppliers"""
        response = self.client.get('/openfarmplanner/api/suppliers/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['name'], "Test Supplier Co.")

    def test_supplier_list_with_search(self):
        """Test searching suppliers"""
        Supplier.objects.create(name="Another Supplier", homepage_url='https://another-supplier.example', project=self.project)
        response = self.client.get('/openfarmplanner/api/suppliers/?q=Test Supplier')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data['results']), 1)
        # At least one result should be "Test Supplier Co."
        supplier_names = [s['name'] for s in response.data['results']]
        self.assertIn("Test Supplier Co.", supplier_names)

    def test_supplier_create_new(self):
        """Test creating a new supplier"""
        data = {'name': 'New Supplier Inc.', 'homepage_url': 'https://new-supplier.example'}
        response = self.client.post('/openfarmplanner/api/suppliers/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Supplier.objects.count(), 2)
        self.assertEqual(response.data['name'], 'New Supplier Inc.')

    def test_supplier_create_existing(self):
        """Test creating supplier with exact duplicate name returns a field error."""
        data = {'name': 'Test Supplier Co.', 'homepage_url': 'https://test-supplier.example'}
        response = self.client.post('/openfarmplanner/api/suppliers/', data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Supplier.objects.count(), 1)
        self.assertIn('name', response.data)
        self.assertEqual(str(response.data['name'][0]), 'Ein Lieferant mit diesem Namen existiert bereits.')

    def test_supplier_create_normalized_match(self):
        """Test creating supplier with normalized match returns a field error."""
        data = {'name': '  TEST SUPPLIER co.  ', 'homepage_url': 'https://test-supplier.example'}
        response = self.client.post('/openfarmplanner/api/suppliers/', data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Supplier.objects.count(), 1)
        self.assertIn('name', response.data)

    def test_supplier_create_allows_same_normalized_name_in_different_projects(self):
        """Test creating the same supplier name in two projects."""
        other_project = Project.objects.create(name='Other Project', slug='other-project')
        ProjectMembership.objects.create(user=self.user, project=other_project, role='admin')
        response = self.client.post(
            '/openfarmplanner/api/suppliers/',
            {'name': self.supplier.name, 'homepage_url': 'https://other-supplier.example'},
            HTTP_X_PROJECT_ID=str(other_project.id),
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], self.supplier.name)
        self.assertEqual(Supplier.objects.filter(name_normalized=self.supplier.name_normalized).count(), 2)

    def test_supplier_create_rejects_trimmed_case_duplicate(self):
        """Test creating normalized duplicates with whitespace and casing differences."""
        Supplier.objects.create(name='Reinsaat', homepage_url='https://reinsaat.example', project=self.project)
        response = self.client.post(
            '/openfarmplanner/api/suppliers/',
            {'name': ' reinsaat ', 'homepage_url': 'https://reinsaat-two.example'},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', response.data)

    def test_supplier_create_allows_empty_homepage_url(self):
        """Test creating supplier without a website."""
        response = self.client.post('/openfarmplanner/api/suppliers/', {'name': 'Supplier Without Website', 'homepage_url': ''})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['homepage_url'], '')

    def test_supplier_create_allows_full_homepage_url(self):
        """Test creating supplier with a full website URL."""
        response = self.client.post(
            '/openfarmplanner/api/suppliers/',
            {'name': 'Supplier With Website', 'homepage_url': 'https://supplier.example/path'},
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['homepage_url'], 'https://supplier.example/path')

    def test_supplier_delete_removes_supplier_and_returns_undo_payload(self):
        """Delete must persist immediately and hand back a restore payload for undo."""
        response = self.client.delete(f'/openfarmplanner/api/suppliers/{self.supplier.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Supplier.objects.filter(pk=self.supplier.id).exists())
        undo_payload = response.data['undo_payload']
        self.assertEqual(undo_payload['supplier']['id'], self.supplier.id)
        self.assertEqual(undo_payload['supplier']['name'], self.supplier.name)
        self.assertEqual(undo_payload['culture_ids'], [])
        self.assertEqual(undo_payload['supplier_data'], [])

    def test_supplier_delete_undo_payload_restores_supplier(self):
        """The undo payload from a delete restores the supplier under its old id."""
        delete_response = self.client.delete(f'/openfarmplanner/api/suppliers/{self.supplier.id}/')
        self.assertEqual(delete_response.status_code, status.HTTP_200_OK)

        restore_response = self.client.post(
            '/openfarmplanner/api/suppliers/restore-unlinked-delete/',
            delete_response.data['undo_payload'],
            format='json',
        )

        self.assertEqual(restore_response.status_code, status.HTTP_200_OK)
        restored = Supplier.objects.get(pk=self.supplier.id)
        self.assertEqual(restored.name, self.supplier.name)
        self.assertEqual(restored.homepage_url, self.supplier.homepage_url)

    def test_supplier_delete_rejects_supplier_still_in_use(self):
        """A supplier referenced by a culture is kept and reported as a conflict."""
        self.culture.supplier = self.supplier
        self.culture.save(update_fields=['supplier'])

        response = self.client.delete(f'/openfarmplanner/api/suppliers/{self.supplier.id}/')

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertFalse(response.data['usage']['can_delete'])
        self.assertTrue(Supplier.objects.filter(pk=self.supplier.id).exists())

    def test_supplier_update_not_limited_by_list_slice(self):
        """Supplier updates must work even if list endpoint shows only first 20 rows."""
        for idx in range(30):
            Supplier.objects.create(
                name=f"A Supplier {idx:02d}",
                homepage_url=f"https://a-supplier-{idx:02d}.example",
                project=self.project,
            )

        target = Supplier.objects.create(name='ZZZ Supplier', homepage_url='https://zzz.example', project=self.project)

        response = self.client.put(
            f'/openfarmplanner/api/suppliers/{target.id}/',
            {
                'name': 'ZZZ Supplier Updated',
                'homepage_url': 'https://zzz-updated.example',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'ZZZ Supplier Updated')

    def test_supplier_update_with_invalid_allowed_domain_returns_400(self):
        """Invalid allowed_domains input should be validated, not crash with 500."""
        response = self.client.put(
            f'/openfarmplanner/api/suppliers/{self.supplier.id}/',
            {
                'name': self.supplier.name,
                'homepage_url': 'https://lieferando.example',
                'allowed_domains': ['lieferando.example', 'www.lieferando.example', 'sdfasdad'],
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('allowed_domains', response.data)

    def test_supplier_create_with_invalid_domain_returns_400(self):
        """Test creating supplier with invalid allowed_domains returns 400."""
        data = {
            'name': 'Invalid Domain Supplier',
            'homepage_url': 'https://example.com',
            'allowed_domains': ['example.com', 'invalid domain', 'https://not-allowed.com']
        }
        response = self.client.post('/openfarmplanner/api/suppliers/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('allowed_domains', response.data)

    def test_supplier_create_with_invalid_url_returns_400(self):
        """Test creating supplier with invalid homepage_url returns 400."""
        invalid_urls = ['invalid-url', 'htp://broken.com', 'just-text']
        for invalid_url in invalid_urls:
            data = {
                'name': f'Test Supplier {invalid_url}',
                'homepage_url': invalid_url,
            }
            response = self.client.post('/openfarmplanner/api/suppliers/', data, format='json')
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, f'Should reject invalid URL: {invalid_url}')
            self.assertIn('homepage_url', response.data, f'Should have homepage_url error for: {invalid_url}')

    def test_supplier_create_with_domain_only_normalizes_to_https(self):
        """Test creating supplier with domain-only URL prepends https://."""
        test_cases = [
            ('example.com', 'https://example.com'),
            ('www.example.com', 'https://www.example.com'),
            ('subdomain.example.co.uk', 'https://subdomain.example.co.uk'),
        ]
        
        for input_url, expected_url in test_cases:
            data = {
                'name': f'Test Supplier for {input_url}',
                'homepage_url': input_url,
            }
            response = self.client.post('/openfarmplanner/api/suppliers/', data, format='json')
            self.assertEqual(response.status_code, status.HTTP_201_CREATED, f'Should accept domain-only URL: {input_url}')
            self.assertEqual(response.data['homepage_url'], expected_url, f'Should normalize {input_url} to {expected_url}')

