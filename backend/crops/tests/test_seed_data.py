from django.test import SimpleTestCase

from crops.seed_data import CROP_SPECIES_SEED_DATA, get_crop_species_seed_name


class CropSpeciesSeedDataTest(SimpleTestCase):
    def test_seed_entries_have_stable_keys_and_initial_translations(self):
        keys = [entry.key for entry in CROP_SPECIES_SEED_DATA]
        german_names = [get_crop_species_seed_name(entry, 'de') for entry in CROP_SPECIES_SEED_DATA]

        self.assertEqual(len(keys), len(set(keys)))
        self.assertEqual(len(german_names), len(set(german_names)))
        self.assertIn('Tomate', german_names)
        self.assertIn('Kartoffel', german_names)
        self.assertIn('Zwiebel', german_names)

        for entry in CROP_SPECIES_SEED_DATA:
            self.assertIn('de', entry.translations)
            self.assertIn('en', entry.translations)
