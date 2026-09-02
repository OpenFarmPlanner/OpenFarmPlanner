"""Unit tests for crop-import unit handling, conversion, and plausibility."""

from django.test import TestCase

from farm.models import Crop, Project, Supplier
from farm.services.crop_import.analysis import (
    ACTION_BLOCKED,
    ACTION_CREATE,
    analyze_import_payload,
)
from farm.services.crop_import.units import (
    CONFIDENCE_CONVERTED,
    CONFIDENCE_EXACT,
    CONFIDENCE_INVALID,
    CONFIDENCE_NEEDS_CLARIFICATION,
)


class ImportAnalysisTestCase(TestCase):
    """Base with one project and small helpers for reading a preview."""

    def setUp(self):
        self.project = Project.objects.create(name='Analysis Project', slug='analysis-project')

    def analyze(self, *items):
        """Analyze the given rows against the test project."""
        return analyze_import_payload(list(items), project=self.project)

    def field_of(self, preview, index, field_name):
        """Return one field entry from a preview row."""
        for entry in preview['items'][index]['fields']:
            if entry['field'] == field_name:
                return entry
        raise AssertionError(f'{field_name} not present in row {index}')

    def error_codes(self, preview, index):
        """Return the error codes of one preview row."""
        return {error['code'] for error in preview['items'][index]['errors']}

    def warning_codes(self, preview, index):
        """Return the warning codes of one preview row."""
        return {warning['code'] for warning in preview['items'][index]['warnings']}


class LengthUnitConversionTests(ImportAnalysisTestCase):
    """Distances must always end up in metres, and never be guessed."""

    def test_centimeter_key_is_converted_to_metres(self):
        preview = self.analyze({'name': 'Brokkoli', 'row_spacing_cm': 50})
        entry = self.field_of(preview, 0, 'row_spacing_m')

        self.assertEqual(entry['source_value'], 50)
        self.assertEqual(entry['source_unit'], 'cm')
        self.assertEqual(entry['api_value'], 0.5)
        self.assertEqual(entry['api_unit'], 'm')
        self.assertEqual(entry['confidence'], CONFIDENCE_CONVERTED)
        self.assertEqual(entry['errors'], [])

    def test_metre_key_is_taken_as_is(self):
        preview = self.analyze({'name': 'Brokkoli', 'row_spacing_m': 0.5})
        entry = self.field_of(preview, 0, 'row_spacing_m')

        self.assertEqual(entry['api_value'], 0.5)
        self.assertEqual(entry['confidence'], CONFIDENCE_EXACT)

    def test_millimetre_key_is_converted(self):
        preview = self.analyze({'name': 'Brokkoli', 'sowing_depth_mm': 20})
        entry = self.field_of(preview, 0, 'sowing_depth_m')

        self.assertEqual(entry['api_value'], 0.02)
        self.assertEqual(entry['confidence'], CONFIDENCE_CONVERTED)

    def test_inline_unit_in_a_string_is_honoured(self):
        preview = self.analyze({'name': 'Brokkoli', 'row_spacing': '50 cm'})
        entry = self.field_of(preview, 0, 'row_spacing_m')

        self.assertEqual(entry['source_unit'], 'cm')
        self.assertEqual(entry['api_value'], 0.5)

    def test_german_decimal_comma_is_accepted(self):
        preview = self.analyze({'name': 'Brokkoli', 'row_spacing': '0,5 m'})
        self.assertEqual(self.field_of(preview, 0, 'row_spacing_m')['api_value'], 0.5)

    def test_value_object_with_unit_is_accepted(self):
        preview = self.analyze({'name': 'Brokkoli', 'row_spacing': {'value': 45, 'unit': 'cm'}})
        self.assertEqual(self.field_of(preview, 0, 'row_spacing_m')['api_value'], 0.45)

    def test_inline_unit_overrides_the_key_unit(self):
        # The key says centimetres, the value says metres. The explicit value
        # wins; guessing the other way round would silently inflate the number.
        preview = self.analyze({'name': 'Brokkoli', 'row_spacing_cm': '0.5 m'})
        entry = self.field_of(preview, 0, 'row_spacing_m')

        self.assertEqual(entry['source_unit'], 'm')
        self.assertEqual(entry['api_value'], 0.5)

    def test_bare_number_without_a_unit_needs_clarification(self):
        preview = self.analyze({'name': 'Karotte', 'row_spacing': 30})
        entry = self.field_of(preview, 0, 'row_spacing_m')

        self.assertIsNone(entry['api_value'])
        self.assertEqual(entry['confidence'], CONFIDENCE_NEEDS_CLARIFICATION)
        self.assertIn('unit_missing', {error['code'] for error in entry['errors']})
        self.assertEqual(preview['items'][0]['action'], ACTION_BLOCKED)

    def test_unknown_unit_is_rejected_and_not_converted(self):
        preview = self.analyze({'name': 'Brokkoli', 'row_spacing': '20 furlongs'})
        entry = self.field_of(preview, 0, 'row_spacing_m')

        self.assertIsNone(entry['api_value'])
        self.assertEqual(entry['confidence'], CONFIDENCE_INVALID)
        self.assertIn('unit_unknown', {error['code'] for error in entry['errors']})

    def test_non_numeric_value_is_rejected(self):
        preview = self.analyze({'name': 'Brokkoli', 'row_spacing_cm': 'wide'})
        entry = self.field_of(preview, 0, 'row_spacing_m')

        self.assertIn('not_a_number', {error['code'] for error in entry['errors']})


class NumericPlausibilityTests(ImportAnalysisTestCase):
    """Impossible values are rejected; merely unusual ones only warn."""

    def test_metres_instead_of_centimetres_is_rejected(self):
        preview = self.analyze({'name': 'Salat', 'row_spacing_m': 30})
        entry = self.field_of(preview, 0, 'row_spacing_m')

        self.assertIn('above_hard_max', {error['code'] for error in entry['errors']})
        self.assertEqual(preview['items'][0]['action'], ACTION_BLOCKED)

    def test_the_same_number_in_centimetres_is_accepted(self):
        preview = self.analyze({'name': 'Salat', 'row_spacing_cm': 30})
        entry = self.field_of(preview, 0, 'row_spacing_m')

        self.assertEqual(entry['api_value'], 0.3)
        self.assertEqual(entry['errors'], [])
        self.assertEqual(entry['warnings'], [])

    def test_negative_distance_is_rejected(self):
        preview = self.analyze({'name': 'Salat', 'row_spacing_cm': -10})
        self.assertIn(
            'below_hard_min',
            {error['code'] for error in self.field_of(preview, 0, 'row_spacing_m')['errors']},
        )

    def test_zero_row_spacing_is_rejected(self):
        preview = self.analyze({'name': 'Salat', 'row_spacing_cm': 0})
        self.assertIn(
            'below_hard_min',
            {error['code'] for error in self.field_of(preview, 0, 'row_spacing_m')['errors']},
        )

    def test_unusually_small_distance_only_warns(self):
        preview = self.analyze({'name': 'Salat', 'row_spacing_cm': 0.5})
        entry = self.field_of(preview, 0, 'row_spacing_m')

        self.assertEqual(entry['errors'], [])
        self.assertIn('below_warn_min', {warning['code'] for warning in entry['warnings']})
        self.assertEqual(preview['items'][0]['action'], ACTION_CREATE)

    def test_unusually_large_distance_only_warns(self):
        preview = self.analyze({'name': 'Kuerbis', 'row_spacing_m': 2.5})
        entry = self.field_of(preview, 0, 'row_spacing_m')

        self.assertEqual(entry['errors'], [])
        self.assertIn('above_warn_max', {warning['code'] for warning in entry['warnings']})

    def test_negative_growth_duration_is_rejected(self):
        preview = self.analyze({'name': 'Salat', 'growth_duration_days': -5})
        self.assertIn(
            'below_hard_min',
            {
                error['code']
                for error in self.field_of(preview, 0, 'growth_duration_days')['errors']
            },
        )

    def test_absurd_growth_duration_is_rejected(self):
        preview = self.analyze({'name': 'Salat', 'growth_duration_days': 5000})
        self.assertIn(
            'above_hard_max',
            {
                error['code']
                for error in self.field_of(preview, 0, 'growth_duration_days')['errors']
            },
        )

    def test_fractional_day_count_is_rejected(self):
        preview = self.analyze({'name': 'Salat', 'growth_duration_days': 12.5})
        self.assertIn(
            'not_a_number',
            {
                error['code']
                for error in self.field_of(preview, 0, 'growth_duration_days')['errors']
            },
        )

    def test_safety_percent_above_hundred_is_rejected(self):
        preview = self.analyze({'name': 'Salat', 'sowing_calculation_safety_percent_direct': 150})
        self.assertIn(
            'above_hard_max',
            {
                error['code']
                for error in self.field_of(
                    preview, 0, 'sowing_calculation_safety_percent_direct'
                )['errors']
            },
        )

    def test_zero_thousand_kernel_weight_is_rejected(self):
        preview = self.analyze({'name': 'Salat', 'thousand_kernel_weight_g': 0})
        self.assertIn(
            'below_hard_min',
            {
                error['code']
                for error in self.field_of(preview, 0, 'thousand_kernel_weight_g')['errors']
            },
        )


class SeedRateCouplingTests(ImportAnalysisTestCase):
    """A seed rate and its unit are only meaningful together."""

    def test_value_without_unit_is_blocked(self):
        preview = self.analyze({'name': 'Karotte', 'seed_rate_direct_value': 5})
        entry = self.field_of(preview, 0, 'seed_rate_direct_value')

        self.assertIn('missing_companion', {error['code'] for error in entry['errors']})
        self.assertEqual(entry['confidence'], CONFIDENCE_NEEDS_CLARIFICATION)
        self.assertEqual(preview['items'][0]['action'], ACTION_BLOCKED)

    def test_unit_without_value_is_blocked(self):
        preview = self.analyze({'name': 'Karotte', 'seed_rate_direct_unit': 'g_per_m2'})
        entry = self.field_of(preview, 0, 'seed_rate_direct_unit')

        self.assertIn('missing_companion', {error['code'] for error in entry['errors']})
        self.assertEqual(preview['items'][0]['action'], ACTION_BLOCKED)

    def test_matching_value_and_unit_are_accepted(self):
        preview = self.analyze({
            'name': 'Karotte',
            'cultivation_types': ['direct_sowing'],
            'seed_rate_direct_value': 1.5,
            'seed_rate_direct_unit': 'g_per_m2',
        })

        self.assertEqual(preview['items'][0]['action'], ACTION_CREATE)
        self.assertEqual(preview['items'][0]['errors'], [])

    def test_seeds_per_plant_requires_whole_number_value(self):
        preview = self.analyze({
            'name': 'Aubergine',
            'cultivation_types': ['pre_cultivation'],
            'seed_rate_pre_cultivation_value': 1.1,
            'seed_rate_pre_cultivation_unit': 'seeds_per_plant',
        })
        entry = self.field_of(preview, 0, 'seed_rate_pre_cultivation_value')

        self.assertIn('whole_number_required', {error['code'] for error in entry['errors']})
        self.assertEqual(preview['items'][0]['action'], ACTION_BLOCKED)

    def test_unknown_seed_rate_unit_is_rejected(self):
        preview = self.analyze({
            'name': 'Karotte',
            'seed_rate_direct_value': 5,
            'seed_rate_direct_unit': 'buckets_per_acre',
        })
        entry = self.field_of(preview, 0, 'seed_rate_direct_unit')

        self.assertIn('unit_unknown', {error['code'] for error in entry['errors']})

    def test_seed_rate_unit_synonym_is_normalized_to_the_canonical_value(self):
        preview = self.analyze({
            'name': 'Karotte',
            'cultivation_types': ['direct_sowing'],
            'seed_rate_direct_value': 1.5,
            'seed_rate_direct_unit': 'g/m²',
        })
        entry = self.field_of(preview, 0, 'seed_rate_direct_unit')

        self.assertEqual(entry['api_value'], 'g_per_m2')
        self.assertEqual(entry['confidence'], CONFIDENCE_CONVERTED)

    def test_seed_rate_far_outside_the_usual_band_warns(self):
        preview = self.analyze({
            'name': 'Karotte',
            'cultivation_types': ['direct_sowing'],
            'seed_rate_direct_value': 900,
            'seed_rate_direct_unit': 'g_per_m2',
        })
        entry = self.field_of(preview, 0, 'seed_rate_direct_value')

        self.assertEqual(entry['errors'], [])
        self.assertIn('above_warn_max', {warning['code'] for warning in entry['warnings']})

    def test_seed_rate_for_an_unused_cultivation_type_warns(self):
        preview = self.analyze({
            'name': 'Karotte',
            'cultivation_types': ['pre_cultivation'],
            'seed_rate_direct_value': 1.5,
            'seed_rate_direct_unit': 'g_per_m2',
        })

        self.assertIn('seed_rate_without_cultivation_type', self.warning_codes(preview, 0))


class EnumAndTextValidationTests(ImportAnalysisTestCase):
    """Enums normalize to the project's vocabulary; unknown values are refused."""

    def test_german_cultivation_type_is_normalized(self):
        preview = self.analyze({'name': 'Salat', 'cultivation_types': ['Anzucht']})
        entry = self.field_of(preview, 0, 'cultivation_types')

        self.assertEqual(entry['api_value'], ['pre_cultivation'])
        self.assertEqual(entry['errors'], [])

    def test_unknown_cultivation_type_is_rejected(self):
        preview = self.analyze({'name': 'Salat', 'cultivation_types': ['hydroponic']})
        self.assertIn(
            'enum_unknown',
            {error['code'] for error in self.field_of(preview, 0, 'cultivation_types')['errors']},
        )

    def test_german_nutrient_demand_is_normalized(self):
        preview = self.analyze({'name': 'Salat', 'nutrient_demand': 'hoch'})
        self.assertEqual(self.field_of(preview, 0, 'nutrient_demand')['api_value'], 'high')

    def test_unknown_nutrient_demand_is_rejected(self):
        preview = self.analyze({'name': 'Salat', 'nutrient_demand': 'enormous'})
        self.assertIn(
            'enum_unknown',
            {error['code'] for error in self.field_of(preview, 0, 'nutrient_demand')['errors']},
        )

    def test_invalid_display_color_is_rejected(self):
        preview = self.analyze({'name': 'Salat', 'display_color': 'green'})
        self.assertIn(
            'invalid_color',
            {error['code'] for error in self.field_of(preview, 0, 'display_color')['errors']},
        )

    def test_overlong_name_is_rejected_rather_than_truncated(self):
        preview = self.analyze({'name': 'x' * 300})
        self.assertIn(
            'too_long', {error['code'] for error in self.field_of(preview, 0, 'name')['errors']}
        )

    def test_missing_name_blocks_the_row(self):
        preview = self.analyze({'variety': 'Calabrese', 'row_spacing_cm': 50})
        self.assertIn('missing_name', self.error_codes(preview, 0))
        self.assertEqual(preview['items'][0]['action'], ACTION_BLOCKED)

    def test_non_object_row_is_blocked(self):
        preview = self.analyze('Brokkoli')
        self.assertEqual(preview['items'][0]['action'], ACTION_BLOCKED)


class UnknownFieldTests(ImportAnalysisTestCase):
    """Order-form columns must not be folded into crop master data."""

    def test_unknown_keys_are_reported_and_ignored(self):
        preview = self.analyze({
            'name': 'Brokkoli',
            'article_no': 'BR-1234',
            'package_size': '25 g',
            'price_eur': 4.9,
            'order_quantity': 3,
        })
        row = preview['items'][0]

        ignored_keys = {entry['key'] for entry in row['ignored_fields']}
        self.assertEqual(
            ignored_keys, {'article_no', 'package_size', 'price_eur', 'order_quantity'}
        )
        self.assertTrue(all(entry['code'] == 'unknown_field' for entry in row['ignored_fields']))

        written_fields = {entry['field'] for entry in row['fields']}
        self.assertEqual(written_fields, {'name'})

    def test_product_name_is_not_used_as_a_variety(self):
        preview = self.analyze({'name': 'Brokkoli', 'product_name': 'Brokkoli Calabrese 25g'})
        row = preview['items'][0]

        self.assertNotIn('variety', {entry['field'] for entry in row['fields']})
        self.assertEqual(row['identity']['variety'], '')

    def test_two_keys_for_the_same_field_are_not_merged(self):
        preview = self.analyze({'name': 'Brokkoli', 'row_spacing_cm': 50, 'row_spacing_m': 0.4})
        row = preview['items'][0]

        self.assertEqual(len([e for e in row['fields'] if e['field'] == 'row_spacing_m']), 1)
        self.assertIn('duplicate_key', {entry['code'] for entry in row['ignored_fields']})


class MatchingAndDuplicateTests(ImportAnalysisTestCase):
    """Matching mirrors the database uniqueness rule and stays project-scoped."""

    def test_existing_crop_is_matched_and_marked_as_update(self):
        Crop.objects.create(name='Brokkoli', variety='Calabrese', project=self.project)
        preview = self.analyze({'name': 'Brokkoli', 'variety': 'Calabrese', 'row_spacing_cm': 50})
        row = preview['items'][0]

        self.assertEqual(row['action'], 'update')
        self.assertIsNotNone(row['matched_crop_id'])
        self.assertEqual(row['matched_by'], 'name_variety_supplier')

    def test_identical_data_is_skipped_rather_than_rewritten(self):
        Crop.objects.create(
            name='Brokkoli', variety='Calabrese', project=self.project, row_spacing_m=0.5
        )
        preview = self.analyze({'name': 'Brokkoli', 'variety': 'Calabrese', 'row_spacing_cm': 50})

        self.assertEqual(preview['items'][0]['action'], 'skip')

    def test_preview_reports_the_currently_stored_value(self):
        Crop.objects.create(
            name='Brokkoli', variety='Calabrese', project=self.project, row_spacing_m=0.4
        )
        preview = self.analyze({'name': 'Brokkoli', 'variety': 'Calabrese', 'row_spacing_cm': 50})
        entry = self.field_of(preview, 0, 'row_spacing_m')

        self.assertEqual(entry['current_value'], 0.4)
        self.assertEqual(entry['api_value'], 0.5)
        self.assertTrue(entry['changes_existing'])

    def test_crops_of_other_projects_are_never_matched(self):
        other_project = Project.objects.create(name='Other', slug='other-project')
        Crop.objects.create(name='Brokkoli', variety='Calabrese', project=other_project)

        preview = self.analyze({'name': 'Brokkoli', 'variety': 'Calabrese'})

        self.assertEqual(preview['items'][0]['action'], ACTION_CREATE)
        self.assertIsNone(preview['items'][0]['matched_crop_id'])

    def test_supplier_specific_crop_is_not_matched_without_a_supplier(self):
        supplier = Supplier.objects.create(
            name='Bingenheimer', homepage_url='https://bingenheimer.example', project=self.project
        )
        Crop.objects.create(
            name='Brokkoli', variety='Calabrese', project=self.project, supplier=supplier
        )

        preview = self.analyze({'name': 'Brokkoli', 'variety': 'Calabrese'})
        self.assertEqual(preview['items'][0]['action'], ACTION_CREATE)

    def test_supplier_name_matches_the_supplier_specific_crop(self):
        supplier = Supplier.objects.create(
            name='Bingenheimer', homepage_url='https://bingenheimer.example', project=self.project
        )
        existing = Crop.objects.create(
            name='Brokkoli', variety='Calabrese', project=self.project, supplier=supplier
        )

        preview = self.analyze({
            'name': 'Brokkoli',
            'variety': 'Calabrese',
            'supplier_name': 'Bingenheimer',
            'row_spacing_cm': 50,
        })

        self.assertEqual(preview['items'][0]['matched_crop_id'], existing.id)

    def test_two_rows_for_the_same_crop_block_the_second(self):
        preview = self.analyze(
            {'name': 'Brokkoli', 'variety': 'Calabrese', 'row_spacing_cm': 50},
            {'name': 'Brokkoli', 'variety': 'Calabrese', 'row_spacing_cm': 60},
        )

        self.assertEqual(preview['items'][0]['action'], ACTION_CREATE)
        self.assertEqual(preview['items'][1]['action'], ACTION_BLOCKED)
        self.assertIn('duplicate_in_payload', self.error_codes(preview, 1))


class PreviewSummaryTests(ImportAnalysisTestCase):
    """The summary must let a caller decide without walking every row."""

    def test_summary_counts_each_action(self):
        Crop.objects.create(name='Bestand', project=self.project, row_spacing_m=0.5)
        preview = self.analyze(
            {'name': 'Neu'},
            {'name': 'Bestand', 'row_spacing_cm': 50},
            {'name': 'Geaendert', 'row_spacing_m': 30},
        )

        self.assertEqual(preview['summary']['total'], 3)
        self.assertEqual(preview['summary']['create'], 1)
        self.assertEqual(preview['summary']['skip'], 1)
        self.assertEqual(preview['summary']['blocked'], 1)
        self.assertTrue(preview['has_errors'])

    def test_warnings_are_surfaced_at_the_top_level(self):
        preview = self.analyze({'name': 'Kuerbis', 'row_spacing_m': 2.5})

        self.assertTrue(preview['has_warnings'])
        self.assertFalse(preview['has_errors'])
        self.assertGreaterEqual(preview['summary']['warnings'], 1)
