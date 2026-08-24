from django.test import TestCase

from crops import services
from crops.models import CropSpecies, CropSpeciesTranslation
from farm.models import PublicCulture


class ListPublishedCropsTest(TestCase):
    def setUp(self):
        self.published = PublicCulture.objects.create(
            name='Lettuce', variety='Bijella', status=PublicCulture.STATUS_PUBLISHED, version=1,
        )
        self.draft = PublicCulture.objects.create(
            name='Carrot', variety='Nantes', status='draft', version=1,
        )

    def test_excludes_unpublished_crops(self):
        results = list(services.list_published_crops())
        self.assertIn(self.published, results)
        self.assertNotIn(self.draft, results)

    def test_excludes_crops_under_rejected_species(self):
        rejected_species = CropSpecies.objects.create(
            name='Rejected bean', status=CropSpecies.STATUS_REJECTED,
        )
        rejected = PublicCulture.objects.create(
            name='Rejected bean', variety='Test', status=PublicCulture.STATUS_PUBLISHED,
            version=1, crop_species=rejected_species,
        )

        results = list(services.list_published_crops())

        self.assertIn(self.published, results)
        self.assertNotIn(rejected, results)

    def test_filters_by_name_and_variety(self):
        other = PublicCulture.objects.create(
            name='Lettuce', variety='Lollo Rosso', status=PublicCulture.STATUS_PUBLISHED, version=1,
        )

        results = list(services.list_published_crops(variety='Bijella'))

        self.assertEqual(results, [self.published])
        self.assertNotIn(other, results)


class GetPublishedCropTest(TestCase):
    def test_returns_published_crop(self):
        crop = PublicCulture.objects.create(
            name='Lettuce', variety='Bijella', status=PublicCulture.STATUS_PUBLISHED, version=1,
        )

        self.assertEqual(services.get_published_crop(crop.id), crop)

    def test_excludes_public_crop_under_rejected_species(self):
        rejected_species = CropSpecies.objects.create(
            name='Rejected bean', status=CropSpecies.STATUS_REJECTED,
        )
        crop = PublicCulture.objects.create(
            name='Rejected bean', variety='Test', status=PublicCulture.STATUS_PUBLISHED,
            version=1, crop_species=rejected_species,
        )

        with self.assertRaises(PublicCulture.DoesNotExist):
            services.get_published_crop(crop.id)


class FindExactCropMatchTest(TestCase):
    def test_returns_none_when_name_or_variety_missing(self):
        self.assertIsNone(services.find_exact_crop_match(name=None, variety='Bijella'))
        self.assertIsNone(services.find_exact_crop_match(name='Lettuce', variety=None))

    def test_matches_regardless_of_case_and_whitespace(self):
        crop = PublicCulture.objects.create(
            name='Lettuce', variety='Bijella', status=PublicCulture.STATUS_PUBLISHED, version=1,
        )

        match = services.find_exact_crop_match(name='  lettuce ', variety='BIJELLA')

        self.assertEqual(match, crop)

    def test_does_not_match_public_crop_under_rejected_species(self):
        rejected_species = CropSpecies.objects.create(
            name='Rejected lettuce', status=CropSpecies.STATUS_REJECTED,
        )
        PublicCulture.objects.create(
            name='Rejected lettuce', variety='Bijella', status=PublicCulture.STATUS_PUBLISHED,
            version=1, crop_species=rejected_species,
        )

        match = services.find_exact_crop_match(name='Rejected lettuce', variety='Bijella')

        self.assertIsNone(match)


class FindSpeciesByCommonNameTest(TestCase):
    def test_resolves_specific_published_species(self):
        species = CropSpecies.objects.create(name='Gartenbohne Spezial')
        CropSpeciesTranslation.objects.create(species=species, language_code='en', common_name='Special garden bean')

        self.assertEqual(services.find_species_by_common_name('Special garden bean'), species)

    def test_ignores_generic_bean_species(self):
        species = CropSpecies.objects.create(name='Bohne')
        CropSpeciesTranslation.objects.create(species=species, language_code='en', common_name='Bean')

        self.assertIsNone(services.find_species_by_common_name('Bohne'))
        self.assertIsNone(services.find_species_by_common_name('Bean'))
