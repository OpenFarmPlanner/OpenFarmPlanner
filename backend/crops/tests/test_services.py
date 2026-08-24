from django.test import TestCase

from crops import services
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

    def test_filters_by_name_and_variety(self):
        other = PublicCulture.objects.create(
            name='Lettuce', variety='Lollo Rosso', status=PublicCulture.STATUS_PUBLISHED, version=1,
        )

        results = list(services.list_published_crops(variety='Bijella'))

        self.assertEqual(results, [self.published])
        self.assertNotIn(other, results)


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
