from django.test import SimpleTestCase

from crops.seed_data import CROP_SPECIES_SEED_DATA, get_crop_species_seed_name


class CropSpeciesSeedDataTest(SimpleTestCase):
    def test_seed_entries_have_stable_keys_and_initial_translations(self):
        keys = [entry.key for entry in CROP_SPECIES_SEED_DATA]
        german_names = [get_crop_species_seed_name(entry, 'de') for entry in CROP_SPECIES_SEED_DATA]

        self.assertEqual(len(keys), len(set(keys)))
        self.assertEqual(len(german_names), len(set(german_names)))
        self.assertGreaterEqual(len(keys), 130)
        self.assertIn('Tomate', german_names)
        self.assertIn('Kartoffel', german_names)
        self.assertIn('Zwiebel', german_names)
        self.assertIn('Bohne', german_names)
        self.assertIn('Buschbohne', german_names)
        self.assertIn('Stangenbohne', german_names)
        self.assertIn('Feuerbohne', german_names)
        self.assertIn('Sojabohne', german_names)
        self.assertNotIn('Kohl', german_names)
        self.assertIn('Weißkraut', german_names)
        self.assertIn('Chinakohl', german_names)
        self.assertIn('Grünkohl', german_names)
        self.assertIn('Kohlrabi', german_names)
        self.assertIn('Rotkraut', german_names)
        self.assertIn('Spitzkraut', german_names)
        self.assertIn('Wirsing', german_names)
        self.assertIn('Raps', german_names)
        self.assertIn('Dinkel', german_names)

        for entry in CROP_SPECIES_SEED_DATA:
            self.assertIn('de', entry.translations)
            self.assertIn('en', entry.translations)
