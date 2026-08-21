"""Tests for the Sorte -> general Kultur value resolver."""

from decimal import Decimal

from django.test import TestCase

from crops.models import CropSpecies
from farm.models import Culture, Project
from farm.services.culture_inheritance import (
    CULTURE_INHERITABLE_FIELDS,
    build_effective_culture_values,
    build_general_culture_index,
    build_inherited_culture_values,
    get_general_culture,
    is_unset_culture_value,
    resolve_culture_field,
)


class CultureInheritanceTest(TestCase):
    """A Sorte falls back to the general Kultur of the same species and project."""

    def setUp(self):
        self.project = Project.objects.create(
            name='Inheritance Project', slug='inheritance-project',
        )
        self.other_project = Project.objects.create(name='Other Project', slug='other-project')
        self.species = CropSpecies.objects.create(name='Daucus carota')
        self.other_species = CropSpecies.objects.create(name='Beta vulgaris')
        self.general = Culture.objects.create(
            name='Karotte',
            variety='',
            project=self.project,
            crop_species=self.species,
            growth_duration_days=70,
            harvest_duration_days=21,
            propagation_duration_days=14,
            harvest_method='per_sqm',
            expected_yield=Decimal('3.50'),
            row_spacing_m=0.3,
            distance_within_row_m=0.05,
            sowing_depth_m=0.02,
            crop_family='Apiaceae',
            nutrient_demand='medium',
            rotation_break_years=4,
            thousand_kernel_weight_g=Decimal('1.20'),
            seed_rate_direct_value=2.0,
            seed_rate_direct_unit='g/m²',
            cultivation_types=['direct_sowing'],
            cultivation_type='direct_sowing',
        )

    def _variety(self, **kwargs) -> Culture:
        defaults = {
            'name': 'Karotte',
            'variety': 'Nantaise',
            'project': self.project,
            'crop_species': self.species,
        }
        defaults.update(kwargs)
        return Culture.objects.create(**defaults)

    def test_unset_detection_treats_zero_and_false_as_values(self):
        self.assertTrue(is_unset_culture_value(None))
        self.assertTrue(is_unset_culture_value(''))
        self.assertTrue(is_unset_culture_value('   '))
        self.assertTrue(is_unset_culture_value('-'))
        self.assertTrue(is_unset_culture_value([]))
        self.assertFalse(is_unset_culture_value(0))
        self.assertFalse(is_unset_culture_value(0.0))
        self.assertFalse(is_unset_culture_value(False))
        self.assertFalse(is_unset_culture_value(['direct_sowing']))

    def test_general_culture_is_found_for_a_linked_variety(self):
        variety = self._variety()
        self.assertEqual(get_general_culture(variety), self.general)

    def test_general_culture_of_the_kultur_itself_is_none(self):
        self.assertIsNone(get_general_culture(self.general))

    def test_free_text_variety_without_species_has_no_general_culture(self):
        variety = self._variety(crop_species=None)
        self.assertIsNone(get_general_culture(variety))
        self.assertIsNone(resolve_culture_field(variety, 'growth_duration_days'))

    def test_general_culture_from_another_project_is_ignored(self):
        variety = self._variety(project=self.other_project)
        self.assertIsNone(get_general_culture(variety))

    def test_general_culture_of_another_species_is_ignored(self):
        variety = self._variety(crop_species=self.other_species)
        self.assertIsNone(get_general_culture(variety))

    def test_soft_deleted_general_culture_is_ignored(self):
        from django.utils import timezone

        self.general.deleted_at = timezone.now()
        self.general.save(update_fields=['deleted_at'])
        variety = self._variety()
        self.assertIsNone(get_general_culture(variety))

    def test_unset_field_resolves_to_the_general_value(self):
        variety = self._variety()
        self.assertEqual(resolve_culture_field(variety, 'harvest_duration_days'), 21)
        self.assertEqual(resolve_culture_field(variety, 'row_spacing_m'), 0.3)
        self.assertEqual(resolve_culture_field(variety, 'crop_family'), 'Apiaceae')
        self.assertEqual(resolve_culture_field(variety, 'rotation_break_years'), 4)

    def test_own_field_wins_over_the_general_value(self):
        variety = self._variety(harvest_duration_days=7, crop_family='Own family')
        self.assertEqual(resolve_culture_field(variety, 'harvest_duration_days'), 7)
        self.assertEqual(resolve_culture_field(variety, 'crop_family'), 'Own family')

    def test_zero_is_an_own_value_and_does_not_inherit(self):
        variety = self._variety(harvest_duration_days=0, sowing_calculation_safety_percent=0)
        self.assertEqual(resolve_culture_field(variety, 'harvest_duration_days'), 0)
        self.assertEqual(resolve_culture_field(variety, 'sowing_calculation_safety_percent'), 0)

    def test_unset_field_stays_unset_when_the_general_kultur_has_no_value_either(self):
        variety = self._variety()
        self.assertIsNone(resolve_culture_field(variety, 'seeding_requirement'))

    def test_non_inheritable_field_is_never_resolved(self):
        variety = self._variety(notes='')
        self.general.notes = 'General notes'
        self.general.save(update_fields=['notes'])
        self.assertEqual(resolve_culture_field(variety, 'notes'), '')

    def test_inherited_values_only_contain_fallback_fields(self):
        variety = self._variety(harvest_duration_days=7)
        inherited = build_inherited_culture_values(variety)
        self.assertNotIn('harvest_duration_days', inherited)
        self.assertEqual(inherited['growth_duration_days'], 70)
        self.assertEqual(inherited['seed_rate_direct_unit'], 'g/m²')
        self.assertNotIn('seeding_requirement', inherited)

    def test_inherited_values_are_empty_without_a_general_culture(self):
        self.assertEqual(build_inherited_culture_values(self._variety(crop_species=None)), {})
        self.assertEqual(build_inherited_culture_values(self.general), {})

    def test_effective_values_cover_every_inheritable_field(self):
        variety = self._variety(harvest_duration_days=7)
        effective = build_effective_culture_values(variety)
        self.assertEqual(set(effective), set(CULTURE_INHERITABLE_FIELDS))
        self.assertEqual(effective['harvest_duration_days'], 7)
        self.assertEqual(effective['growth_duration_days'], 70)
        self.assertIsNone(effective['seeding_requirement'])

    def test_index_resolves_without_a_query_per_culture(self):
        varieties = [self._variety(variety=f'Sorte {index}') for index in range(3)]
        with self.assertNumQueries(1):
            index = build_general_culture_index(self.project.id)
        with self.assertNumQueries(0):
            for variety in varieties:
                self.assertEqual(resolve_culture_field(variety, 'growth_duration_days', index), 70)

    def test_index_is_scoped_to_one_project(self):
        Culture.objects.create(
            name='Karotte', variety='', project=self.other_project,
            crop_species=self.species, growth_duration_days=99,
        )
        index = build_general_culture_index(self.project.id)
        self.assertEqual(index[self.species.id], self.general)

    def test_lookup_is_cached_on_the_instance(self):
        variety = self._variety()
        with self.assertNumQueries(1):
            get_general_culture(variety)
        with self.assertNumQueries(0):
            get_general_culture(variety)
