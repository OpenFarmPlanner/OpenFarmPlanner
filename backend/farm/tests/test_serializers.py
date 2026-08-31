from datetime import date
from decimal import Decimal

from django.test import TestCase
from rest_framework import serializers

from farm.models import Bed, Culture, Field, Location, PlantingPlan, Project, Season, Supplier
from farm.common.serializer_fields import CentimetersField
from farm.planning.serializers import PlantingPlanSerializer
from farm.cultures.serializers import CultureSerializer
from farm.structure.serializers import BedSerializer, FieldSerializer, LocationSerializer
from farm.utils.normalization import normalize_supplier_name, normalize_text


class NormalizationUtilsTest(TestCase):
    def test_normalize_text_handles_none_blank_and_casefold(self):
        self.assertIsNone(normalize_text(None))
        self.assertIsNone(normalize_text('   '))
        self.assertEqual(normalize_text('  Äpfel\t UND  Birnen  '), 'äpfel und birnen')

    def test_normalize_supplier_name_removes_suffixes_and_trims(self):
        self.assertEqual(normalize_supplier_name('  Farm Co. KG '), 'farm')
        self.assertEqual(normalize_supplier_name('Green Ltd.'), 'green')
        self.assertIsNone(normalize_supplier_name('   '))


class SerializerBranchCoverageTest(TestCase):
    def setUp(self):
        self.project = Project.objects.create(name='Serializer Test Project', slug='serializer-test-project')
        self.location = Location.objects.create(name='Standort A', project=self.project)
        self.field = Field.objects.create(name='Feld A', location=self.location, area_sqm=200, project=self.project)
        self.bed = Bed.objects.create(name='Beet A', field=self.field, area_sqm=30, project=self.project)

    def test_centimeters_field_conversion(self):
        field = CentimetersField()
        self.assertEqual(field.to_representation(0.25), 25.0)
        self.assertIsNone(field.to_representation(None))
        self.assertEqual(field.to_internal_value('15'), 0.15)

    def test_culture_serializer_creates_supplier_from_supplier_name(self):
        serializer = CultureSerializer(
            data={
                'name': 'Salat',
                'variety': 'Lollo Rosso',
                'growth_duration_days': 6,
                'harvest_duration_days': 2,
                'harvest_method': 'per_sqm',
                'supplier_name': '  ACME Seeds GmbH ',
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        # `project` is read-only on the serializer and assigned server-side.
        culture = serializer.save(project=self.project)

        self.assertIsNotNone(culture.supplier)
        self.assertEqual(culture.supplier.name_normalized, 'acme seeds')
        self.assertEqual(Supplier.objects.count(), 1)


    def test_culture_serializer_allows_harvest_duration_without_harvest_method(self):
        serializer = CultureSerializer(
            data={
                'name': 'Kohl',
                'variety': 'Türkis',
                'growth_duration_days': 90,
                'harvest_duration_days': 21,
                'project': self.project.id,
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_rejects_invalid_cultivation_types(self):
        serializer = CultureSerializer(
            data={
                'name': 'Kohl',
                'variety': 'X',
                'cultivation_types': ['invalid'],
                'project': self.project.id,
            }
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn('cultivation_types', serializer.errors)

    def test_validates_seed_rate_by_cultivation_units(self):
        serializer = CultureSerializer(
            data={
                'name': 'Kohl',
                'variety': 'X',
                'cultivation_types': ['pre_cultivation', 'direct_sowing'],
                'seed_rate_by_cultivation': {
                    'pre_cultivation': {'value': 2, 'unit': 'invalid_unit'},
                    'direct_sowing': {'value': 3, 'unit': 'seeds_per_lfm'},
                },
                'project': self.project.id,
            }
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn('seed_rate_by_cultivation', serializer.errors)

    def test_validates_seed_rate_by_cultivation_keys_subset(self):
        serializer = CultureSerializer(
            data={
                'name': 'Kohl',
                'variety': 'X',
                'cultivation_types': ['pre_cultivation'],
                'seed_rate_by_cultivation': {
                    'direct_sowing': {'value': 3, 'unit': 'seeds_per_lfm'},
                },
                'project': self.project.id,
            }
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn('seed_rate_by_cultivation', serializer.errors)

    def test_allows_pre_cultivation_g_per_m2_seed_rate(self):
        serializer = CultureSerializer(
            data={
                'name': 'Kohl',
                'variety': 'X',
                'cultivation_types': ['pre_cultivation', 'direct_sowing'],
                'seed_rate_by_cultivation': {
                    'pre_cultivation': {'value': 0.045, 'unit': 'g_per_m2'},
                    'direct_sowing': {'value': 0.09, 'unit': 'g_per_m2'},
                },
                'project': self.project.id,
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_validates_only_active_cultivation_seed_fields(self):
        serializer = CultureSerializer(
            data={
                'name': 'Fenchel',
                'variety': 'X',
                'cultivation_types': ['direct_sowing'],
                'seed_rate_direct_value': 0.14,
                'project': self.project.id,
            }
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn('seed_rate_direct_unit', serializer.errors)
        self.assertNotIn('seed_rate_pre_cultivation_unit', serializer.errors)

    def test_accepts_pre_cultivation_only_without_direct_fields(self):
        serializer = CultureSerializer(
            data={
                'name': 'Lauch',
                'variety': 'X',
                'cultivation_types': ['pre_cultivation'],
                'seed_rate_pre_cultivation_value': 1.5,
                'seed_rate_pre_cultivation_unit': 'g_per_m2',
                'project': self.project.id,
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_accepts_agent_seed_requirements_object(self):
        serializer = CultureSerializer(
            data={
                'name': 'Tomate',
                'variety': 'San Marzano',
                'cultivation_types': ['pre_cultivation'],
                'seed_requirements': {
                    'pre_cultivation': {
                        'value': 2,
                        'unit': 'seeds_per_plant',
                        'safety_percent': 15,
                    },
                },
                'project': self.project.id,
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        culture = serializer.save(project=self.project)
        self.assertEqual(culture.seed_rate_pre_cultivation_value, 2)
        self.assertEqual(culture.seed_rate_pre_cultivation_unit, 'seeds_per_plant')
        self.assertEqual(culture.sowing_calculation_safety_percent_pre_cultivation, 15)
        self.assertEqual(
            culture.seed_rate_by_cultivation,
            {'pre_cultivation': {'value': 2.0, 'unit': 'seeds_per_plant'}},
        )

    def test_represents_seed_requirements_object(self):
        culture = Culture.objects.create(
            name='Tomate',
            variety='San Marzano',
            cultivation_types=['pre_cultivation'],
            seed_rate_pre_cultivation_value=2,
            seed_rate_pre_cultivation_unit='seeds_per_plant',
            sowing_calculation_safety_percent_pre_cultivation=15,
            project=self.project,
        )

        data = CultureSerializer(culture).data

        self.assertEqual(
            data['seed_requirements'],
            {
                'pre_cultivation': {
                    'value': 2.0,
                    'unit': 'seeds_per_plant',
                    'safety_percent': 15.0,
                },
            },
        )

    def test_rejects_conflicting_seed_requirements_and_flat_fields(self):
        serializer = CultureSerializer(
            data={
                'name': 'Tomate',
                'variety': 'San Marzano',
                'cultivation_types': ['pre_cultivation'],
                'seed_rate_pre_cultivation_value': 1,
                'seed_rate_pre_cultivation_unit': 'seeds_per_plant',
                'seed_requirements': {
                    'pre_cultivation': {'value': 2, 'unit': 'seeds_per_plant'},
                },
                'project': self.project.id,
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('seed_requirements', serializer.errors)

    def test_allows_seed_rate_units_without_values(self):
        serializer = CultureSerializer(
            data={
                'name': 'Mangold',
                'variety': 'X',
                'cultivation_types': ['direct_sowing', 'pre_cultivation'],
                'seed_rate_direct_unit': 'g_per_m2',
                'sowing_calculation_safety_percent_direct': 10,
                'seed_rate_pre_cultivation_unit': 'g_per_m2',
                'sowing_calculation_safety_percent_pre_cultivation': 10,
                'thousand_kernel_weight_g': '3.50',
                'project': self.project.id,
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_normalizes_legacy_empty_seed_rate_unit_placeholder(self):
        serializer = CultureSerializer(
            data={
                'name': 'Mangold',
                'variety': 'X',
                'cultivation_types': ['pre_cultivation'],
                'seed_rate_pre_cultivation_unit': '-',
                'project': self.project.id,
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertIsNone(serializer.validated_data['seed_rate_pre_cultivation_unit'])

    def test_represents_legacy_empty_seed_rate_unit_placeholder_as_null(self):
        culture = Culture.objects.create(
            name='Mangold',
            variety='X',
            cultivation_types=['pre_cultivation'],
            seed_rate_pre_cultivation_unit='-',
            project=self.project,
        )

        data = CultureSerializer(culture).data

        self.assertIsNone(data['seed_rate_pre_cultivation_unit'])

    def test_accepts_direct_sowing_seeds_per_plant_unit(self):
        serializer = CultureSerializer(
            data={
                'name': 'Bohne',
                'variety': 'X',
                'cultivation_types': ['direct_sowing'],
                'seed_rate_direct_value': 2,
                'seed_rate_direct_unit': 'seeds_per_plant',
                'project': self.project.id,
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_accepts_direct_sowing_only(self):
        serializer = CultureSerializer(
            data={
                'name': 'Möhre',
                'variety': 'X',
                'cultivation_types': ['direct_sowing'],
                'seed_rate_direct_value': 2.5,
                'seed_rate_direct_unit': 'g_per_m2',
                'project': self.project.id,
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_accepts_both_cultivation_methods(self):
        serializer = CultureSerializer(
            data={
                'name': 'Sellerie',
                'variety': 'X',
                'cultivation_types': ['direct_sowing', 'pre_cultivation'],
                'seed_rate_direct_value': 1.2,
                'seed_rate_direct_unit': 'g_per_m2',
                'seed_rate_pre_cultivation_value': 0.8,
                'seed_rate_pre_cultivation_unit': 'g_per_m2',
                'project': self.project.id,
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_accepts_small_method_seed_rate_values(self):
        serializer = CultureSerializer(
            data={
                'name': 'Karotte',
                'variety': 'Nantaise',
                'cultivation_types': ['direct_sowing', 'pre_cultivation'],
                'seed_rate_direct_value': 0.014,
                'seed_rate_direct_unit': 'g_per_m2',
                'seed_rate_pre_cultivation_value': 1.357,
                'seed_rate_pre_cultivation_unit': 'g_per_m2',
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        # `project` is read-only on the serializer and assigned server-side.
        culture = serializer.save(project=self.project)
        self.assertEqual(culture.seed_rate_direct_value, 0.014)
        self.assertEqual(culture.seed_rate_pre_cultivation_value, 1.357)

    def test_notes_without_quellen_section_are_allowed(self):
        serializer = CultureSerializer(
            data={
                'name': 'Kohl',
                'variety': 'X',
                'notes': '## Hinweise\n- abc',
                'project': self.project.id,
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)



    def test_planting_plan_serializer_rejects_invalid_area_input(self):
        serializer = PlantingPlanSerializer()

        with self.assertRaises(serializers.ValidationError):
            serializer.validate({'area_input_value': Decimal('0'), 'area_input_unit': 'M2'})

        with self.assertRaises(serializers.ValidationError):
            serializer.validate({'area_input_value': Decimal('10')})

    def test_planting_plan_serializer_converts_plants_to_area_and_computes_count(self):
        culture = Culture.objects.create(
            name='Möhre',
            growth_duration_days=8,
            harvest_duration_days=3,
            distance_within_row_m=0.2,
            row_spacing_m=0.5,
            project=self.project,
        )

        season = Season.objects.create(
            project=self.project,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 12, 31),
        )

        serializer = PlantingPlanSerializer()
        attrs = serializer.validate(
            {
                'culture': culture,
                'bed': self.bed,
                'season': season,
                'planting_date': date(2024, 4, 1),
                'area_input_value': Decimal('100'),
                'area_input_unit': 'PLANTS',
            }
        )

        self.assertIn('area_usage_sqm', attrs)
        self.assertGreater(attrs['area_usage_sqm'], 0)

        plan = PlantingPlan.objects.create(
            culture=culture,
            bed=self.bed,
            planting_date=date(2024, 4, 1),
            area_usage_sqm=attrs['area_usage_sqm'],
            project=self.project,
        )
        self.assertIsNotNone(serializer.get_plants_count(plan))


    def test_bed_serializer_rejects_more_than_one_decimal_place(self):
        serializer = BedSerializer(
            data={
                'name': 'Beet B',
                'field': self.field.id,
                'area_sqm': '12.34',
                'project': self.project.id,
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('area_sqm', serializer.errors)

    def test_bed_serializer_allows_one_decimal_place(self):
        serializer = BedSerializer(
            data={
                'name': 'Beet B',
                'field': self.field.id,
                'area_sqm': '12.3',
                'project': self.project.id,
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)


    def test_field_serializer_rejects_more_than_one_decimal_place(self):
        serializer = FieldSerializer(
            data={
                'name': 'Parzelle B',
                'location': self.location.id,
                'area_sqm': '12.34',
                'project': self.project.id,
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn('area_sqm', serializer.errors)

    def test_field_serializer_allows_one_decimal_place(self):
        serializer = FieldSerializer(
            data={
                'name': 'Parzelle B',
                'location': self.location.id,
                'area_sqm': '12.3',
                'project': self.project.id,
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_field_serializer_rejects_duplicate_name_in_same_location(self):
        serializer = FieldSerializer(
            data={
                'name': self.field.name,
                'location': self.location.id,
                'area_sqm': '12.3',
                'project': self.project.id,
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertEqual(
            serializer.errors['name'][0],
            'Eine Parzelle mit diesem Namen existiert in diesem Standort bereits.',
        )

    def test_field_serializer_allows_duplicate_name_in_different_location(self):
        other_location = Location.objects.create(name='Standort B', project=self.project)
        serializer = FieldSerializer(
            data={
                'name': self.field.name,
                'location': other_location.id,
                'area_sqm': '12.3',
                'project': self.project.id,
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_location_serializer_does_not_require_project_field(self):
        serializer = LocationSerializer(data={'name': 'Standort B'})
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_location_serializer_accepts_comma_decimal_coordinates(self):
        serializer = LocationSerializer(
            data={
                'name': 'Standort C',
                'latitude': '46,6145',
                'longitude': '13,8503',
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data['latitude'], 46.6145)
        self.assertEqual(serializer.validated_data['longitude'], 13.8503)

    def test_location_serializer_rejects_out_of_range_coordinates(self):
        serializer = LocationSerializer(
            data={
                'name': 'Standort D',
                'latitude': '120.0',
                'longitude': '13.8503',
            }
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn('latitude', serializer.errors)

    def test_location_serializer_accepts_agronomic_optional_fields(self):
        serializer = LocationSerializer(
            data={
                'name': 'Standort E',
                'address': 'Hauptstraße 12',
                'description': 'Acker hinter Hof',
                'soil_type': Location.SOIL_TYPE_SAND,
                'exposure': Location.EXPOSURE_WEST,
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_location_serializer_rejects_invalid_choice_values(self):
        serializer = LocationSerializer(
            data={
                'name': 'Standort F',
                'soil_type': 'peat',
                'exposure': 'northwest',
            }
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn('soil_type', serializer.errors)
        self.assertIn('exposure', serializer.errors)

    def test_field_serializer_does_not_require_project_field(self):
        serializer = FieldSerializer(
            data={
                'name': 'Parzelle C',
                'location': self.location.id,
                'area_sqm': '10.0',
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_bed_serializer_does_not_require_project_field(self):
        serializer = BedSerializer(
            data={
                'name': 'Beet C',
                'field': self.field.id,
                'area_sqm': '5.0',
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_bed_serializer_rejects_duplicate_name_in_same_field(self):
        serializer = BedSerializer(
            data={
                'name': self.bed.name,
                'field': self.field.id,
                'area_sqm': '5.0',
                'project': self.project.id,
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertEqual(
            serializer.errors['name'][0],
            'Ein Beet mit diesem Namen existiert in dieser Parzelle bereits.',
        )

    def test_bed_serializer_allows_duplicate_name_in_different_field(self):
        other_field = Field.objects.create(
            name='Feld B',
            location=self.location,
            area_sqm=200,
            project=self.project,
        )
        serializer = BedSerializer(
            data={
                'name': self.bed.name,
                'field': other_field.id,
                'area_sqm': '5.0',
                'project': self.project.id,
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_culture_serializer_does_not_require_project_field(self):
        serializer = CultureSerializer(
            data={
                'name': 'Spinat',
                'variety': 'Matador',
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
