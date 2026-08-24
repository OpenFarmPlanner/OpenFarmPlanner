from datetime import date

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from farm.models import (
    Bed,
    Culture,
    CultureSupplierData,
    Field,
    Location,
    PlantingPlan,
    Project,
    ProjectMembership,
    Season,
    Supplier,
)

User = get_user_model()


class SeedDemandSupplierSelectionApiTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='seedselect', email='seedselect@example.com', password='testpass', is_active=True)
        self.project = Project.objects.create(name='Seed Select Project', slug='seed-select-project')
        ProjectMembership.objects.create(user=self.user, project=self.project, role='admin')
        self.client.force_authenticate(user=self.user)
        self.client.defaults['HTTP_X_PROJECT_ID'] = str(self.project.id)

        location = Location.objects.create(name='Loc', project=self.project)
        field = Field.objects.create(name='Field', location=location, project=self.project)
        self.bed = Bed.objects.create(name='Bed', field=field, area_sqm=100, project=self.project)

    def _create_plan(self, culture: Culture, area: float, season: object = None):
        return PlantingPlan.objects.create(
            culture=culture,
            bed=self.bed,
            planting_date=date(2026, 3, 1),
            area_usage_sqm=area,
            cultivation_type='direct_sowing',
            project=self.project,
            season=season,
        )

    def test_seed_demand_can_switch_supplier_per_culture(self):
        culture = Culture.objects.create(
            name='Karotte',
            variety='Nantaise',
            cultivation_types=['direct_sowing'],
            seed_rate_direct_value=11,
            seed_rate_direct_unit='g_per_m2',
            project=self.project,
        )
        supplier_a = Supplier.objects.create(name='Reinsaat', homepage_url='https://reinsaat.example', project=self.project)
        supplier_b = Supplier.objects.create(name='Bingenheimer', homepage_url='https://bingenheimer.example', project=self.project)
        CultureSupplierData.objects.create(
            culture=culture,
            supplier=supplier_a,
            project=self.project,
            packaging_sizes=[{'size_value': 5, 'size_unit': 'g'}, {'size_value': 50, 'size_unit': 'g'}],
        )
        CultureSupplierData.objects.create(
            culture=culture,
            supplier=supplier_b,
            project=self.project,
            packaging_sizes=[{'size_value': 25, 'size_unit': 'g'}],
        )
        self._create_plan(culture, 5)

        response = self.client.get('/openfarmplanner/api/seed-demand/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = response.data['results'][0]
        self.assertEqual(len(row['supplier_options']), 2)

        selected_response = self.client.post(
            '/openfarmplanner/api/seed-demand/',
            {'culture_id': culture.id, 'supplier_id': supplier_a.id},
            format='json',
        )
        self.assertEqual(selected_response.status_code, status.HTTP_200_OK)
        self.assertEqual(selected_response.data['selected_supplier_id'], supplier_a.id)

        reloaded = self.client.get('/openfarmplanner/api/seed-demand/')
        selected_row = reloaded.data['results'][0]
        self.assertEqual(selected_row['selected_supplier_id'], supplier_a.id)
        self.assertEqual(selected_row['seed_packages'], [{'size_value': 5.0, 'size_unit': 'g'}, {'size_value': 50.0, 'size_unit': 'g'}])

    def test_seed_demand_shows_warning_without_supplier_data(self):
        culture = Culture.objects.create(
            name='Mangold',
            cultivation_types=['direct_sowing'],
            seed_rate_direct_value=3,
            seed_rate_direct_unit='g_per_m2',
            project=self.project,
        )
        self._create_plan(culture, 5)

        response = self.client.get('/openfarmplanner/api/seed-demand/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = response.data['results'][0]
        self.assertEqual(row['warning'], 'Keine Lieferantendaten vorhanden.')
        self.assertEqual(row['supplier_options'], [])

    def test_seed_demand_uses_single_supplier_for_response_without_persisting_selection(self):
        culture = Culture.objects.create(
            name='Petersilie',
            cultivation_types=['direct_sowing'],
            seed_rate_direct_value=4,
            seed_rate_direct_unit='g_per_m2',
            project=self.project,
        )
        supplier = Supplier.objects.create(name='Only Supplier', homepage_url='https://only.example', project=self.project)
        CultureSupplierData.objects.create(
            culture=culture,
            supplier=supplier,
            project=self.project,
            packaging_sizes=[{'size_value': 10, 'size_unit': 'g'}],
        )
        self._create_plan(culture, 5)

        response = self.client.get('/openfarmplanner/api/seed-demand/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = response.data['results'][0]
        self.assertEqual(row['selected_supplier_id'], supplier.id)

        culture.refresh_from_db()
        self.assertIsNone(culture.selected_seed_demand_supplier_id)

    def test_seed_demand_displays_seed_requirement_as_grams_with_selected_supplier_tkg(self):
        culture = Culture.objects.create(
            name='Radieschen',
            cultivation_types=['direct_sowing'],
            seed_rate_direct_value=1000,
            seed_rate_direct_unit='seeds_per_m2',
            project=self.project,
        )
        supplier = Supplier.objects.create(name='TKG Supplier', homepage_url='https://tkg.example', project=self.project)
        CultureSupplierData.objects.create(
            culture=culture,
            supplier=supplier,
            project=self.project,
            thousand_kernel_weight_g=5,
            packaging_sizes=[{'size_value': 10, 'size_unit': 'g'}],
        )
        self._create_plan(culture, 2)

        response = self.client.get('/openfarmplanner/api/seed-demand/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = response.data['results'][0]
        self.assertEqual(row['required_amount_value'], 10.0)
        self.assertEqual(row['required_amount_unit'], 'g')
        self.assertEqual(row['total_grams'], 10.0)
        self.assertIsNone(row['required_amount_warning'])

    def test_seed_demand_hides_seed_requirement_when_tkg_is_missing(self):
        culture = Culture.objects.create(
            name='Kresse',
            cultivation_types=['direct_sowing'],
            seed_rate_direct_value=1000,
            seed_rate_direct_unit='seeds_per_m2',
            project=self.project,
        )
        supplier = Supplier.objects.create(name='No TKG Supplier', homepage_url='https://no-tkg.example', project=self.project)
        CultureSupplierData.objects.create(
            culture=culture,
            supplier=supplier,
            project=self.project,
            packaging_sizes=[{'size_value': 1000, 'size_unit': 'seeds'}],
        )
        self._create_plan(culture, 2)

        response = self.client.get('/openfarmplanner/api/seed-demand/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row = response.data['results'][0]
        self.assertIsNone(row['required_amount_value'])
        self.assertEqual(row['required_amount_unit'], 'g')
        self.assertIsNone(row['total_grams'])
        self.assertEqual(row['required_amount_warning'], 'missing_tkg')

    def test_scoped_to_the_active_season_when_the_header_is_present(self):
        """Without X-Season-Id, plans from every season still aggregate together
        (backward-compatible); with it, only the active season's plans count."""
        culture_a = Culture.objects.create(
            name='Karotte', cultivation_types=['direct_sowing'],
            seed_rate_direct_value=11, seed_rate_direct_unit='g_per_m2', project=self.project,
        )
        culture_b = Culture.objects.create(
            name='Mangold', cultivation_types=['direct_sowing'],
            seed_rate_direct_value=3, seed_rate_direct_unit='g_per_m2', project=self.project,
        )
        season_a = Season.objects.create(project=self.project, start_date=date(2026, 1, 1), end_date=date(2026, 12, 31))
        season_b = Season.objects.create(project=self.project, start_date=date(2027, 1, 1), end_date=date(2027, 12, 31))
        self._create_plan(culture_a, 5, season=season_a)
        self._create_plan(culture_b, 5, season=season_b)

        unscoped = self.client.get('/openfarmplanner/api/seed-demand/')
        self.assertEqual({row['culture_name'] for row in unscoped.data['results']}, {'Karotte', 'Mangold'})

        scoped = self.client.get('/openfarmplanner/api/seed-demand/', HTTP_X_SEASON_ID=str(season_a.id))
        self.assertEqual({row['culture_name'] for row in scoped.data['results']}, {'Karotte'})
