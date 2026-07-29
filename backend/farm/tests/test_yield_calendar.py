from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from crops.models import CropSpecies, CropSpeciesTranslation
from farm.models import Bed, Culture, Field, Location, PlantingPlan, Project, ProjectMembership

User = get_user_model()


class YieldCalendarAPITest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='yielduser', email='yield@example.com', password='testpass', is_active=True)
        self.project = Project.objects.create(name='Yield Project', slug='yield-project')
        ProjectMembership.objects.create(user=self.user, project=self.project, role='admin')
        self.client.force_authenticate(user=self.user)
        self.client.defaults['HTTP_X_PROJECT_ID'] = str(self.project.id)
        location = Location.objects.create(name='Loc', project=self.project)
        field = Field.objects.create(name='Field', location=location, project=self.project)
        self.bed = Bed.objects.create(name='Bed', field=field, area_sqm=100, project=self.project)

    def _create_plan(self, *, culture: Culture, harvest_start: date, harvest_end: date):
        plan = PlantingPlan.objects.create(
            culture=culture,
            bed=self.bed,
            planting_date=harvest_start,
            project=self.project,
        )
        PlantingPlan.objects.filter(id=plan.id).update(harvest_date=harvest_start, harvest_end_date=harvest_end)
        plan.refresh_from_db()
        return plan

    def test_harvest_inside_single_week_goes_to_one_week(self):
        carrot = Culture.objects.create(name='Karotte', expected_yield=70, display_color='#F4A261', project=self.project)
        self._create_plan(culture=carrot, harvest_start=date(2026, 3, 3), harvest_end=date(2026, 3, 6))

        response = self.client.get('/openfarmplanner/api/yield-calendar/?year=2026')
        self.assertEqual(response.status_code, 200)

        payload = response.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]['iso_week'], '2026-W10')
        self.assertEqual(payload[0]['cultures'][0]['culture_name'], 'Karotte')
        self.assertAlmostEqual(payload[0]['cultures'][0]['yield'], 70.0, places=2)

    def test_yield_calendar_localizes_linked_culture_species_name(self):
        species = CropSpecies.objects.create(name='Yield Calendar Localized Species')
        CropSpeciesTranslation.objects.create(species=species, language_code='de', common_name='Ackerbohne')
        CropSpeciesTranslation.objects.create(species=species, language_code='en', common_name='Broad bean')
        bean = Culture.objects.create(
            name='Ackerbohne',
            crop_species=species,
            expected_yield=70,
            display_color='#6D597A',
            project=self.project,
        )
        self._create_plan(culture=bean, harvest_start=date(2026, 3, 3), harvest_end=date(2026, 3, 6))

        response = self.client.get('/openfarmplanner/api/yield-calendar/?year=2026', HTTP_ACCEPT_LANGUAGE='en')

        self.assertEqual(response.status_code, 200)
        culture = response.json()[0]['cultures'][0]
        self.assertEqual(culture['culture_id'], bean.id)
        self.assertEqual(culture['culture_name'], 'Ackerbohne')
        self.assertEqual(culture['culture_display_name'], 'Broad bean')
        self.assertEqual(culture['culture_display_language_code'], 'en')

    def test_harvest_spanning_multiple_weeks_splits_proportionally(self):
        leek = Culture.objects.create(name='Lauch', expected_yield=100, display_color='#2A9D8F', project=self.project)
        self._create_plan(culture=leek, harvest_start=date(2026, 3, 5), harvest_end=date(2026, 3, 17))

        response = self.client.get('/openfarmplanner/api/yield-calendar/?year=2026')
        self.assertEqual(response.status_code, 200)

        rows = {row['iso_week']: row for row in response.json()}
        self.assertAlmostEqual(rows['2026-W10']['cultures'][0]['yield'], 33.33, places=2)
        self.assertAlmostEqual(rows['2026-W11']['cultures'][0]['yield'], 58.33, places=2)
        self.assertAlmostEqual(rows['2026-W12']['cultures'][0]['yield'], 8.33, places=2)

    def test_iso_year_boundary_uses_iso_week_keys(self):
        spinach = Culture.objects.create(name='Spinat', expected_yield=80, display_color='#90BE6D', project=self.project)
        self._create_plan(culture=spinach, harvest_start=date(2024, 12, 30), harvest_end=date(2025, 1, 6))

        response = self.client.get('/openfarmplanner/api/yield-calendar/?year=2025')
        self.assertEqual(response.status_code, 200)

        payload = response.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]['iso_week'], '2025-W01')
        self.assertEqual(payload[0]['week_start'], '2024-12-30')
        self.assertEqual(payload[0]['week_end'], '2025-01-06')
        self.assertAlmostEqual(payload[0]['cultures'][0]['yield'], 80.0, places=2)

    def test_multiple_plans_same_culture_same_week_sum(self):
        onion = Culture.objects.create(name='Zwiebel', expected_yield=10, display_color='#E9C46A', project=self.project)
        self._create_plan(culture=onion, harvest_start=date(2026, 3, 2), harvest_end=date(2026, 3, 9))
        self._create_plan(culture=onion, harvest_start=date(2026, 3, 2), harvest_end=date(2026, 3, 9))

        response = self.client.get('/openfarmplanner/api/yield-calendar/?year=2026')
        self.assertEqual(response.status_code, 200)

        payload = response.json()
        self.assertEqual(len(payload), 1)
        self.assertAlmostEqual(payload[0]['cultures'][0]['yield'], 20.0, places=2)

    def test_multiple_cultures_are_separate_stack_segments(self):
        tomato = Culture.objects.create(name='Tomate', expected_yield=30, display_color='#E63946', project=self.project)
        carrot = Culture.objects.create(name='Karotte', expected_yield=20, display_color='#F4A261', project=self.project)

        self._create_plan(culture=tomato, harvest_start=date(2026, 3, 2), harvest_end=date(2026, 3, 9))
        self._create_plan(culture=carrot, harvest_start=date(2026, 3, 2), harvest_end=date(2026, 3, 9))

        response = self.client.get('/openfarmplanner/api/yield-calendar/?year=2026')
        self.assertEqual(response.status_code, 200)

        cultures = response.json()[0]['cultures']
        names = {item['culture_name'] for item in cultures}
        self.assertEqual(names, {'Tomate', 'Karotte'})
        yields = {item['culture_name']: item['yield'] for item in cultures}
        self.assertAlmostEqual(yields['Tomate'], 30.0, places=2)
        self.assertAlmostEqual(yields['Karotte'], 20.0, places=2)
