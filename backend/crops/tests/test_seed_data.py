from django.test import SimpleTestCase

from crops.seed_data import CROP_SPECIES_SEED_DATA, get_crop_species_seed_name


class CropSpeciesSeedDataTest(SimpleTestCase):
    def test_seed_entries_have_stable_keys_and_initial_translations(self):
        keys = [entry.key for entry in CROP_SPECIES_SEED_DATA]
        german_names = [
            get_crop_species_seed_name(entry, 'de')
            for entry in CROP_SPECIES_SEED_DATA
        ]
        english_names = [
            get_crop_species_seed_name(entry, 'en')
            for entry in CROP_SPECIES_SEED_DATA
        ]

        self.assertEqual(len(keys), len(set(keys)))
        self.assertEqual(len(german_names), len(set(german_names)))
        self.assertGreaterEqual(len(keys), 180)
        self.assertIn('Tomate', german_names)
        self.assertIn('Kartoffel', german_names)
        self.assertIn('Zwiebel', german_names)
        self.assertNotIn('Bohne', german_names)
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
        self.assertNotIn('Gründüngung', german_names)
        self.assertNotIn('Green manure', english_names)

        dach_supplier_extension_names = [
            'Alexandrinerklee',
            'Bischofskraut',
            'Blattsenf',
            'Brunnenkresse',
            'Gartenmelde',
            'Inkarnatklee',
            'Kapuzinerkresse',
            'Komatsuna',
            'Kornblume',
            'Mizuna',
            'Neuseeländer Spinat',
            'Ölrettich',
            'Phacelia',
            'Portulak',
            'Ringelblume',
            'Salatrauke',
            'Shiso',
            'Strohblume',
            'Tatsoi',
            'Wilde Rauke',
            'Winterkresse',
            'Winterportulak',
            'Zinnie',
            'Zuckerhut',
        ]
        for name in dach_supplier_extension_names:
            self.assertIn(name, german_names)

        for entry in CROP_SPECIES_SEED_DATA:
            self.assertIn('de', entry.translations)
            self.assertIn('en', entry.translations)
            self.assertIsInstance(entry.scientific_name, str)
            self.assertIsInstance(entry.family, str)
            self.assertIsInstance(entry.categories, tuple)
            for category in entry.categories:
                self.assertEqual(category, category.strip().lower())

    def test_seed_entries_can_carry_species_metadata(self):
        leaf_mustard = next(
            entry for entry in CROP_SPECIES_SEED_DATA if entry.key == 'leaf_mustard'
        )

        self.assertEqual(leaf_mustard.scientific_name, 'Brassica juncea')
        self.assertEqual(leaf_mustard.family, 'Brassicaceae')
        self.assertEqual(leaf_mustard.categories, ('vegetable',))

    def test_seed_entries_use_concrete_species_instead_of_supplier_categories(self):
        """Guards the naming convention documented in docs/crop-library-architecture.md.

        Slash collective names and supplier/shop categories mix several
        botanical species with different growing and harvest logic, so they
        must never become suggestable crop species again.
        """
        german_names = [
            get_crop_species_seed_name(entry, 'de')
            for entry in CROP_SPECIES_SEED_DATA
        ]
        english_names = [
            get_crop_species_seed_name(entry, 'en')
            for entry in CROP_SPECIES_SEED_DATA
        ]

        for name in german_names + english_names:
            self.assertNotIn('/', name)

        supplier_category_names = [
            'Asiatisches Blattgemüse/Senfkohl',
            'Asiatisches Blattgemüse',
            'Asiatische Blattgemüse',
            'Asiasalat',
            'Asiasalate',
            'Asian greens',
        ]
        for name in supplier_category_names:
            self.assertNotIn(name, german_names)
            self.assertNotIn(name, english_names)

        concrete_asian_greens_names = [
            'Blattsenf',
            'Chinakohl',
            'Komatsuna',
            'Mibuna',
            'Mizuna',
            'Pak Choi',
            'Tatsoi',
        ]
        for name in concrete_asian_greens_names:
            self.assertIn(name, german_names)
        self.assertIn('Mustard greens', english_names)
