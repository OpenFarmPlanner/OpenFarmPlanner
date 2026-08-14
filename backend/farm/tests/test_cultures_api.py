"""API tests for cultures, supplier data, and seed demand."""

from datetime import date

from rest_framework import status

from crops.models import CropSpecies
from farm.models import (
    Culture,
    CultureSupplierData,
    PlantingPlan,
    Project,
    PublicCulture,
    SeedPackage,
    Supplier,
)
from farm.tests.api_base import ProjectApiTestCase


class CultureApiTest(ProjectApiTestCase):
    def test_culture_with_supplier(self):
        """Test creating culture with supplier"""
        data = {
            'name': 'Culture with Supplier',
            'growth_duration_days': 8,
            'harvest_duration_days': 3,
            'harvest_method': 'per_plant',
            'supplier_name': self.supplier.name,
            'project': self.project.id,
        }
        response = self.client.post('/openfarmplanner/api/cultures/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['supplier']['id'], self.supplier.id)

    def test_culture_list(self):
        response = self.client.get('/openfarmplanner/api/cultures/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)

    def test_culture_list_query_count_does_not_scale_with_result_count(self):
        # Regression test: get_queryset() previously dropped the select_related/
        # prefetch_related applied on the class-level `queryset`, causing one extra
        # query per culture for `supplier`, `image_file`, `source_public_culture`,
        # `seed_packages`, and the owned-public-culture lookup.
        for index in range(5):
            Culture.objects.create(
                name=f'Extra Culture {index}',
                growth_duration_days=7,
                harvest_duration_days=2,
                project=self.project,
                supplier=self.supplier,
            )

        with self.assertNumQueries(8):
            response = self.client.get('/openfarmplanner/api/cultures/')
            self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 6)

    def test_culture_detail_returns_all_supplier_data_rows(self):
        supplier_a = Supplier.objects.create(name='Supplier A', homepage_url='https://supplier-a.example', project=self.project)
        supplier_b = Supplier.objects.create(name='Supplier B', homepage_url='https://supplier-b.example', project=self.project)
        CultureSupplierData.objects.create(
            culture=self.culture,
            supplier=supplier_a,
            project=self.project,
            supplier_product_name='Alpha Product',
            packaging_sizes=[{'size_value': 5, 'size_unit': 'g'}],
        )
        CultureSupplierData.objects.create(
            culture=self.culture,
            supplier=supplier_b,
            project=self.project,
            supplier_product_name='Beta Product',
            packaging_sizes=[{'size_value': 10, 'size_unit': 'g'}],
        )

        response = self.client.get(f'/openfarmplanner/api/cultures/{self.culture.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['supplier_data']), 2)
        supplier_names = {entry['supplier']['name'] for entry in response.data['supplier_data']}
        self.assertEqual(supplier_names, {'Supplier A', 'Supplier B'})

    def test_culture_create(self):
        data = {
            'name': 'New Culture',
            'variety': 'Test Variety',
            'growth_duration_days': 6,
            'harvest_duration_days': 2,
            'harvest_method': 'per_plant',
            'project': self.project.id,
        }
        response = self.client.post('/openfarmplanner/api/cultures/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Culture.objects.count(), 2)
        # Check that display color was auto-generated
        self.assertIn('display_color', response.data)
        self.assertTrue(response.data['display_color'].startswith('#'))

    def test_culture_create_allows_same_name_with_different_variety(self):
        data = {
            'name': self.culture.name,
            'variety': 'Different Variety',
            'project': self.project.id,
        }
        response = self.client.post('/openfarmplanner/api/cultures/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_culture_create_and_update_general_data_with_null_variety(self):
        response = self.client.post(
            '/openfarmplanner/api/cultures/',
            {
                'name': 'General Tomato',
                'variety': None,
                'crop_family': 'Solanaceae',
                'growth_duration_days': 80,
                'row_spacing_cm': 60,
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['variety'], '')

        update_response = self.client.patch(
            f'/openfarmplanner/api/cultures/{response.data["id"]}/',
            {'variety': None, 'growth_duration_days': 90, 'notes': 'General baseline'},
            format='json',
        )

        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data['variety'], '')
        self.assertEqual(update_response.data['growth_duration_days'], 90)
        self.assertEqual(update_response.data['notes'], 'General baseline')

    def test_culture_create_rejects_duplicate_name_and_variety(self):
        existing = Culture.objects.create(
            name='Duplicate Test Culture',
            variety='Nantaise',
            project=self.project,
        )
        data = {
            'name': existing.name,
            'variety': existing.variety,
            'project': self.project.id,
        }
        response = self.client.post('/openfarmplanner/api/cultures/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', response.data)

    def test_culture_create_rejects_duplicate_name_and_variety_case_and_whitespace_insensitive(self):
        existing = Culture.objects.create(
            name='Duplicate Whitespace Culture',
            variety='Nantaise',
            project=self.project,
        )
        data = {
            'name': f"  {existing.name.upper()}  ",
            'variety': f"  {existing.variety.upper()}  ",
            'project': self.project.id,
        }
        response = self.client.post('/openfarmplanner/api/cultures/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', response.data)

    def test_culture_duplicate_check_is_project_scoped_and_excludes_public_cultures(self):
        Culture.objects.create(name='Tomate', variety='Roma', project=self.project)
        other_project = Project.objects.create(name='Other Project', slug='other-project')
        Culture.objects.create(name='Paprika', variety='Sweet', project=other_project)
        PublicCulture.objects.create(name='Bohne', variety='Neckargold', status='published')

        matching_response = self.client.get(
            '/openfarmplanner/api/cultures/duplicate-check/',
            {'name': ' tomate ', 'variety': 'ROMA'},
        )
        other_project_response = self.client.get(
            '/openfarmplanner/api/cultures/duplicate-check/',
            {'name': 'Paprika', 'variety': 'Sweet'},
        )
        public_response = self.client.get(
            '/openfarmplanner/api/cultures/duplicate-check/',
            {'name': 'Bohne', 'variety': 'Neckargold'},
        )

        self.assertEqual(matching_response.status_code, status.HTTP_200_OK)
        self.assertTrue(matching_response.data['exists'])
        self.assertFalse(other_project_response.data['exists'])
        self.assertFalse(public_response.data['exists'])

    def test_culture_duplicate_check_supports_general_data_without_variety(self):
        Culture.objects.create(name='General Bean', variety='', project=self.project)

        response = self.client.get(
            '/openfarmplanner/api/cultures/duplicate-check/',
            {'name': ' general bean ', 'variety': ''},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['exists'])

    def test_public_culture_match_returns_exact_normalized_match(self):
        PublicCulture.objects.create(name='Tomate', variety='Roma', status='published')

        response = self.client.get(
            '/openfarmplanner/api/public-cultures/match/',
            {'name': ' tomate ', 'variety': 'ROMA'},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['exists'])
        self.assertEqual(response.data['culture']['name'], 'Tomate')

    def test_link_public_culture_updates_private_reference_without_creating_public_entry(self):
        species = CropSpecies.objects.get(name_normalized='tomate')
        public_culture = PublicCulture.objects.create(
            name='Tomate',
            variety='Roma',
            status=PublicCulture.STATUS_PUBLISHED,
            crop_species=species,
            version=4,
        )
        private_culture = Culture.objects.create(
            name='Paradeiser',
            variety='Roma',
            growth_duration_days=88,
            project=self.project,
        )
        public_count_before = PublicCulture.objects.count()

        response = self.client.post(
            f'/openfarmplanner/api/cultures/{private_culture.id}/link-public-culture/',
            {'public_culture_id': public_culture.id},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        private_culture.refresh_from_db()
        self.assertEqual(PublicCulture.objects.count(), public_count_before)
        self.assertEqual(private_culture.source_public_culture_id, public_culture.id)
        self.assertEqual(private_culture.source_public_version, 4)
        self.assertEqual(private_culture.crop_species_id, species.id)
        self.assertEqual(private_culture.name, 'Paradeiser')
        self.assertTrue(private_culture.is_modified_from_source)

    def test_culture_create_with_all_fields(self):
        """Test creating culture with all manual planning fields"""
        data = {
            'name': 'Comprehensive Culture',
            'variety': 'Special Edition',
            'notes': 'Test notes',
            'crop_family': 'Solanaceae',
            'nutrient_demand': 'high',
            'cultivation_type': 'pre_cultivation',
            'growth_duration_days': 8,
            'harvest_duration_days': 3,
            'propagation_duration_days': 4,
            'harvest_method': 'per_plant',
            'expected_yield': 500.0,
            'allow_deviation_delivery_weeks': True,
            'distance_within_row_cm': 40.0,
            'row_spacing_cm': 60.0,
            'sowing_depth_cm': 1.5,
            'thousand_kernel_weight_g': 472.02,
            'display_color': '#FF5733',
            'project': self.project.id,
        }
        response = self.client.post('/openfarmplanner/api/cultures/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Comprehensive Culture')
        self.assertEqual(response.data['crop_family'], 'Solanaceae')
        self.assertEqual(response.data['nutrient_demand'], 'high')
        self.assertEqual(response.data['thousand_kernel_weight_g'], 472.02)
        self.assertEqual(response.data['display_color'], '#FF5733')

    def test_culture_create_without_durations(self):
        """Test that creating culture without durations is allowed"""
        data = {
            'name': 'Culture Without Durations',
            'variety': 'Optional Timing',
            'supplier_name': self.supplier.name,
            'project': self.project.id,
        }
        response = self.client.post('/openfarmplanner/api/cultures/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(response.data['growth_duration_days'])
        self.assertIsNone(response.data['harvest_duration_days'])

    def test_culture_create_invalid_display_color(self):
        """Test that invalid display color format is rejected"""
        data = {
            'name': 'Test Culture',
            'growth_duration_days': 6,
            'harvest_duration_days': 2,
            'harvest_method': 'per_plant',
            'display_color': 'invalid',  # Not hex format
            'project': self.project.id,
        }
        response = self.client.post('/openfarmplanner/api/cultures/', data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('display_color', response.data)

    def test_culture_update(self):
        """Test updating a culture"""
        data = {
            'name': 'Updated Culture',
            'growth_duration_days': 8,
            'harvest_duration_days': 3,
            'harvest_method': 'per_plant',
            'crop_family': 'Updated Family',
            'nutrient_demand': 'medium',
            'project': self.project.id,
        }
        response = self.client.put(f'/openfarmplanner/api/cultures/{self.culture.id}/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], 'Updated Culture')
        self.assertEqual(response.data['crop_family'], 'Updated Family')

    def test_culture_update_persists_thousand_kernel_weight_on_culture(self):
        data = {
            'name': self.culture.name,
            'variety': self.culture.variety,
            'growth_duration_days': self.culture.growth_duration_days,
            'harvest_duration_days': self.culture.harvest_duration_days,
            'harvest_method': self.culture.harvest_method,
            'thousand_kernel_weight_g': 4.2,
            'project': self.project.id,
        }
        response = self.client.put(f'/openfarmplanner/api/cultures/{self.culture.id}/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['thousand_kernel_weight_g'], 4.2)
        self.culture.refresh_from_db()
        self.assertEqual(float(self.culture.thousand_kernel_weight_g), 4.2)

    def test_culture_rename_cascades_to_sibling_varieties_grouped_by_name(self):
        """Renaming one row of a crop (grouped by name, no crop_species link)
        must rename its siblings too, so the variety stays in the same crop
        group instead of splitting off into what looks like a new crop."""
        variety_a = Culture.objects.create(
            name=self.culture.name, variety='Variety A', project=self.project,
        )
        variety_b = Culture.objects.create(
            name=self.culture.name, variety='Variety B', project=self.project,
        )
        unrelated = Culture.objects.create(
            name='Unrelated Culture', variety='', project=self.project,
        )

        response = self.client.patch(
            f'/openfarmplanner/api/cultures/{variety_a.id}/',
            {'name': 'Renamed Culture'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.culture.refresh_from_db()
        variety_b.refresh_from_db()
        unrelated.refresh_from_db()
        self.assertEqual(self.culture.name, 'Renamed Culture')
        self.assertEqual(variety_b.name, 'Renamed Culture')
        self.assertEqual(unrelated.name, 'Unrelated Culture')

    def test_culture_rename_cascades_to_siblings_grouped_by_crop_species(self):
        """When rows are linked via crop_species, renaming groups by that
        link instead of the (possibly stale) name, matching the frontend's
        own grouping logic."""
        species = CropSpecies.objects.create(name='Rename Species Test')
        self.culture.crop_species = species
        self.culture.save(update_fields=['crop_species'])
        linked_variety = Culture.objects.create(
            name=self.culture.name, variety='Linked Variety', crop_species=species,
            project=self.project,
        )
        same_name_unlinked = Culture.objects.create(
            name=self.culture.name, variety='Unlinked Same Name', project=self.project,
        )

        response = self.client.patch(
            f'/openfarmplanner/api/cultures/{self.culture.id}/',
            {'name': 'Renamed Species Culture'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        linked_variety.refresh_from_db()
        same_name_unlinked.refresh_from_db()
        self.assertEqual(linked_variety.name, 'Renamed Species Culture')
        self.assertEqual(same_name_unlinked.name, 'API Test Culture')

    def test_culture_partial_update_persists_thousand_kernel_weight_on_culture(self):
        response = self.client.patch(
            f'/openfarmplanner/api/cultures/{self.culture.id}/',
            {'thousand_kernel_weight_g': 3.8},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['thousand_kernel_weight_g'], 3.8)
        self.culture.refresh_from_db()
        self.assertEqual(float(self.culture.thousand_kernel_weight_g), 3.8)

    def test_culture_update_with_seed_packages_payload_from_get(self):
        """PUT with seed package objects (including id/culture) should stay valid."""
        supplier = Supplier.objects.create(name='Seed Supplier', homepage_url='https://seed-supplier.example', project=self.project)
        culture = Culture.objects.create(
            name='Payload Culture',
            variety='Classic',
            supplier=supplier,
            growth_duration_days=10,
            harvest_duration_days=2,
            harvest_method='per_plant',
            project=self.project,
        )
        package = SeedPackage.objects.create(culture=culture, size_value='25.0', size_unit='g', project=self.project)

        payload = {
            'id': culture.id,
            'name': culture.name,
            'variety': culture.variety,
            'supplier_id': supplier.id,
            'growth_duration_days': culture.growth_duration_days,
            'harvest_duration_days': culture.harvest_duration_days,
            'harvest_method': culture.harvest_method,
            'project': self.project.id,
            'seed_packages': [
                {
                    'id': package.id,
                    'culture': culture.id,
                    'size_value': 25.0,
                    'size_unit': 'g',
                                    }
            ],
        }

        response = self.client.put(f'/openfarmplanner/api/cultures/{culture.id}/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['seed_packages']), 1)
        self.assertEqual(response.data['seed_packages'][0]['size_unit'], 'g')
        self.assertEqual(float(response.data['seed_packages'][0]['size_value']), 25.0)
        self.assertEqual(SeedPackage.objects.get(culture=culture).project, self.project)

    def test_culture_update_creates_supplier_data_without_culture_in_payload(self):
        """Nested supplier rows should inherit the parent culture automatically."""
        supplier = Supplier.objects.create(name='Nested Supplier', homepage_url='https://nested-supplier.example', project=self.project)
        culture = Culture.objects.create(
            name='Nested Culture',
            variety='Create',
            growth_duration_days=10,
            harvest_duration_days=3,
            harvest_method='per_plant',
            project=self.project,
        )
        payload = {
            'id': culture.id,
            'name': culture.name,
            'variety': culture.variety,
            'growth_duration_days': culture.growth_duration_days,
            'harvest_duration_days': culture.harvest_duration_days,
            'harvest_method': culture.harvest_method,
            'project': self.project.id,
            'supplier_data_input': [
                {
                    'supplier_id': supplier.id,
                    'supplier_product_name': 'Nested product',
                    'packaging_sizes': [{'size_value': 50, 'size_unit': 'g'}],
                }
            ],
        }

        response = self.client.put(f'/openfarmplanner/api/cultures/{culture.id}/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['supplier_data']), 1)
        row = CultureSupplierData.objects.get(culture=culture, supplier=supplier)
        self.assertEqual(row.supplier_product_name, 'Nested product')
        self.assertEqual(row.project_id, self.project.id)

    def test_culture_update_updates_existing_supplier_data_rows(self):
        """Rows with ids should update in place instead of being recreated."""
        supplier = Supplier.objects.create(name='Update Supplier', homepage_url='https://update-supplier.example', project=self.project)
        culture = Culture.objects.create(
            name='Nested Update',
            variety='Update',
            growth_duration_days=10,
            harvest_duration_days=3,
            harvest_method='per_plant',
            project=self.project,
        )
        existing = CultureSupplierData.objects.create(
            culture=culture,
            supplier=supplier,
            project=self.project,
            supplier_product_name='Before',
        )
        payload = {
            'id': culture.id,
            'name': culture.name,
            'variety': culture.variety,
            'growth_duration_days': culture.growth_duration_days,
            'harvest_duration_days': culture.harvest_duration_days,
            'harvest_method': culture.harvest_method,
            'project': self.project.id,
            'supplier_data_input': [
                {
                    'id': existing.id,
                    'supplier_id': supplier.id,
                    'supplier_product_name': 'After',
                    'packaging_sizes': [{'size_value': 25, 'size_unit': 'g'}],
                }
            ],
        }

        response = self.client.put(f'/openfarmplanner/api/cultures/{culture.id}/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(CultureSupplierData.objects.filter(culture=culture).count(), 1)
        existing.refresh_from_db()
        self.assertEqual(existing.supplier_product_name, 'After')
        self.assertEqual(existing.packaging_sizes, [{'size_value': 25, 'size_unit': 'g'}])

    def test_culture_update_changes_existing_supplier_data_supplier(self):
        """Changing the supplier on an existing supplier-data row should persist."""
        supplier_a = Supplier.objects.create(name='Lieferant2', homepage_url='https://supplier-a.example', project=self.project)
        supplier_b = Supplier.objects.create(name='Reinsaat', homepage_url='https://reinsaat.example', project=self.project)
        culture = Culture.objects.create(
            name='Supplier Switch',
            variety='A to B',
            growth_duration_days=10,
            harvest_duration_days=3,
            harvest_method='per_plant',
            project=self.project,
        )
        existing = CultureSupplierData.objects.create(
            culture=culture,
            supplier=supplier_a,
            project=self.project,
            supplier_product_name='Before',
            packaging_sizes=[{'size_value': 10, 'size_unit': 'g'}],
        )
        payload = {
            'id': culture.id,
            'name': culture.name,
            'variety': culture.variety,
            'growth_duration_days': culture.growth_duration_days,
            'harvest_duration_days': culture.harvest_duration_days,
            'harvest_method': culture.harvest_method,
            'project': self.project.id,
            'supplier_data_input': [
                {
                    'id': existing.id,
                    'supplier_id': supplier_b.id,
                    'supplier_product_name': 'After',
                    'packaging_sizes': [{'size_value': 25, 'size_unit': 'g'}],
                }
            ],
        }

        response = self.client.put(f'/openfarmplanner/api/cultures/{culture.id}/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(CultureSupplierData.objects.filter(culture=culture).count(), 1)
        existing.refresh_from_db()
        self.assertEqual(existing.supplier_id, supplier_b.id)
        self.assertEqual(existing.supplier_product_name, 'After')
        self.assertEqual(response.data['supplier_data'][0]['supplier']['name'], 'Reinsaat')

        payload['supplier_data_input'][0]['supplier_id'] = supplier_a.id
        payload['supplier_data_input'][0]['supplier_product_name'] = 'Back to A'

        response = self.client.put(f'/openfarmplanner/api/cultures/{culture.id}/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(CultureSupplierData.objects.filter(culture=culture).count(), 1)
        existing.refresh_from_db()
        self.assertEqual(existing.supplier_id, supplier_a.id)
        self.assertEqual(existing.supplier_product_name, 'Back to A')
        self.assertEqual(response.data['supplier_data'][0]['supplier']['name'], 'Lieferant2')

    def test_culture_update_supplier_data_without_culture_field_regression(self):
        """Regression: nested supplier rows must not fail with culture required 400."""
        supplier = Supplier.objects.create(name='Regression Supplier', homepage_url='https://regression-supplier.example', project=self.project)
        payload = {
            'id': self.culture.id,
            'name': self.culture.name,
            'growth_duration_days': self.culture.growth_duration_days,
            'harvest_duration_days': self.culture.harvest_duration_days,
            'project': self.project.id,
            'supplier_data_input': [
                {
                    'supplier_id': supplier.id,
                    'supplier_product_name': 'Regression row',
                }
            ],
        }

        response = self.client.put(f'/openfarmplanner/api/cultures/{self.culture.id}/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn('culture', response.data)
        self.assertEqual(CultureSupplierData.objects.filter(culture=self.culture, supplier=supplier).count(), 1)

    def test_culture_update_ignores_empty_supplier_data_rows(self):
        payload = {
            'id': self.culture.id,
            'name': self.culture.name,
            'growth_duration_days': self.culture.growth_duration_days,
            'harvest_duration_days': self.culture.harvest_duration_days,
            'project': self.project.id,
            'supplier_data_input': [
                {
                    'packaging_sizes': [],
                    'supplier_product_name': '',
                    'notes': '',
                }
            ],
        }

        response = self.client.put(f'/openfarmplanner/api/cultures/{self.culture.id}/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(CultureSupplierData.objects.filter(culture=self.culture).count(), 0)

    def test_culture_update_rejects_supplier_data_without_supplier(self):
        payload = {
            'id': self.culture.id,
            'name': self.culture.name,
            'growth_duration_days': self.culture.growth_duration_days,
            'harvest_duration_days': self.culture.harvest_duration_days,
            'project': self.project.id,
            'supplier_data_input': [
                {
                    'supplier_product_name': 'Product without supplier',
                    'packaging_sizes': [{'size_value': 25, 'size_unit': 'g'}],
                }
            ],
        }

        response = self.client.put(f'/openfarmplanner/api/cultures/{self.culture.id}/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('supplier_data_input', response.data)
        self.assertEqual(CultureSupplierData.objects.filter(culture=self.culture).count(), 0)

    def test_seed_demand_uses_supplier_specific_packages_for_existing_cultures(self):
        """Supplier-scoped package sizes should appear in seed demand for existing cultures."""
        culture = Culture.objects.create(
            name='Legacy Bean',
            variety='Classic',
            growth_duration_days=70,
            harvest_duration_days=14,
            harvest_method='per_plant',
            seed_rate_value=5,
            seed_rate_unit='g_per_m2',
            project=self.project,
        )
        supplier = Supplier.objects.create(
            name='Bean Supplier',
            homepage_url='https://beans.example',
            project=self.project,
        )
        CultureSupplierData.objects.create(
            culture=culture,
            supplier=supplier,
            project=self.project,
            packaging_sizes=[{'size_value': 25.0, 'size_unit': 'g'}],
        )
        PlantingPlan.objects.create(
            culture=culture,
            bed=self.bed,
            planting_date=date(2025, 3, 1),
            area_usage_sqm=5,
            project=self.project,
        )

        response = self.client.get('/openfarmplanner/api/seed-demand/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = next(item for item in response.data['results'] if item['culture_name'] == 'Legacy Bean')
        self.assertEqual(row['seed_packages'], [{'size_value': 25.0, 'size_unit': 'g'}])
        self.assertEqual(row['package_suggestion']['pack_count'], 1)

    def test_culture_supplier_product_url_domain_mismatch_rejected(self):
        data = {
            'name': 'Culture with URL mismatch',
            'variety': 'X',
            'supplier_id': self.supplier.id,
            'supplier_product_url': 'https://other.example/product',
            'growth_duration_days': 8,
            'harvest_duration_days': 3,
            'harvest_method': 'per_plant',
            'project': self.project.id,
        }
        response = self.client.post('/openfarmplanner/api/cultures/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('supplier_product_url', response.data)
