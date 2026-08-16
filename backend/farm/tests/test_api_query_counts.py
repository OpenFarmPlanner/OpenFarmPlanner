"""Query-count regression tests for the farm list endpoints.

Every assertion here pins the number of SQL statements a list response costs.
The point is not the exact number but that it is *constant*: the fixtures below
create three rows per collection, each with its own related records, so any
relation a serializer resolves per row (a missing `select_related`,
`prefetch_related`, or an accidental extra lookup inside a
`SerializerMethodField`) shows up as a failing count instead of as a slow
production endpoint.

When a count changes, first work out whether the change is per-row. Adding one
constant query (a new prefetch) is normally fine; a count that grows with
`ROW_COUNT` is an N+1 and needs a queryset fix, not a bigger number here.
"""

from datetime import date

from crops.models import CropSpecies, CropSpeciesTranslation
from farm.models import (
    Bed,
    Culture,
    CultureSupplierData,
    Field,
    Location,
    PlantingPlan,
    PublicCulture,
    SeedPackage,
    Supplier,
    Task,
)
from farm.tests.api_base import ProjectApiTestCase

# Three is enough for an N+1 to change the total, and small enough that a
# failure message stays readable.
ROW_COUNT = 3


class ListEndpointQueryCountTest(ProjectApiTestCase):
    """Each list endpoint must cost the same number of queries for every row."""

    def setUp(self):
        super().setUp()
        # ProjectApiTestCase already provides one location/field/bed/culture/
        # supplier; top the project up to ROW_COUNT of each and give every row
        # the related records its serializer touches.
        self.locations = [self.location]
        self.fields = [self.field]
        self.beds = [self.bed]
        self.cultures = [self.culture]
        self.suppliers = [self.supplier]
        self.public_cultures = []

        for index in range(ROW_COUNT):
            if index > 0:
                self.locations.append(Location.objects.create(
                    name=f'Location {index}', project=self.project,
                ))
                self.fields.append(Field.objects.create(
                    name=f'Field {index}', location=self.locations[index], project=self.project,
                ))
                self.beds.append(Bed.objects.create(
                    name=f'Bed {index}', field=self.fields[index],
                    area_sqm=20, project=self.project,
                ))
                self.suppliers.append(Supplier.objects.create(
                    name=f'Supplier {index}', homepage_url='https://supplier.example',
                    project=self.project,
                ))

            # One species stays unreviewed so both list serializers resolve
            # `crop_species_status` / `public_crop_species_pending` against a
            # `proposed` row too, not only against published ones.
            species = CropSpecies.objects.create(
                name=f'Query count species {index}',
                status=CropSpecies.STATUS_PROPOSED if index == 0 else CropSpecies.STATUS_PUBLISHED,
            )
            CropSpeciesTranslation.objects.create(
                species=species, language_code='de', common_name=f'Art {index}',
            )
            CropSpeciesTranslation.objects.create(
                species=species, language_code='en', common_name=f'Species {index}',
            )

            culture = self.cultures[index] if index == 0 else Culture.objects.create(
                name=f'Culture {index}', variety='Sorte', project=self.project,
                growth_duration_days=30, harvest_duration_days=5,
            )
            if index > 0:
                self.cultures.append(culture)
            culture.crop_species = species
            culture.supplier = self.suppliers[index]
            culture.save(update_fields=['crop_species', 'supplier'])

            CultureSupplierData.objects.create(
                culture=culture, supplier=self.suppliers[index], project=self.project,
            )
            SeedPackage.objects.create(
                culture=culture, size_value=10, size_unit='g', project=self.project,
            )
            plan = PlantingPlan.objects.create(
                culture=culture, bed=self.beds[index], planting_date=date(2026, 4, 1),
                area_usage_sqm=5, project=self.project,
                created_by=self.user, updated_by=self.user,
            )
            Task.objects.create(title=f'Task {index}', planting_plan=plan, project=self.project)

            public_culture = PublicCulture.objects.create(
                name=f'Public culture {index}', variety='Sorte',
                status=PublicCulture.STATUS_PUBLISHED, crop_species=species, created_by=self.user,
            )
            self.public_cultures.append(public_culture)
            # An imported copy so the serializer's `project_import_status`
            # has something to resolve for every public row.
            Culture.objects.create(
                name=f'Imported culture {index}', variety='Sorte', project=self.project,
                source_public_culture=public_culture,
            )

    def assert_list_query_count(
        self, url: str, expected_queries: int, expected_rows: int = ROW_COUNT,
    ) -> None:
        """GET `url` and pin both its query count and how many rows it served.

        The row assertion matters: a count assertion on an accidentally empty
        list would pass while measuring nothing.
        """
        with self.assertNumQueries(expected_queries):
            response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']), expected_rows)

    def test_locations_list_query_count(self):
        self.assert_list_query_count('/openfarmplanner/api/locations/', 8)

    def test_fields_list_query_count(self):
        """`location_name` comes from the serializer's dotted source."""
        self.assert_list_query_count('/openfarmplanner/api/fields/', 5)

    def test_beds_list_query_count(self):
        """`field_name` needs `field`, and the layout code needs `field__location`."""
        self.assert_list_query_count('/openfarmplanner/api/beds/', 5)

    def test_suppliers_list_query_count(self):
        self.assert_list_query_count('/openfarmplanner/api/suppliers/', 5)

    def test_cultures_list_query_count(self):
        """The heaviest project list: supplier rows, seed packages, species
        translations, the owned-public-culture lookup and that entry's species
        status are all per-row data that the viewset resolves with prefetches."""
        # Each culture created above also has an imported sibling row, so the
        # project holds twice ROW_COUNT cultures.
        self.assert_list_query_count(
            '/openfarmplanner/api/cultures/', 10, expected_rows=ROW_COUNT * 2,
        )

    def test_culture_supplier_data_list_query_count(self):
        """Rows embed a full nested `SupplierSerializer`."""
        self.assert_list_query_count('/openfarmplanner/api/culture-supplier-data/', 5)

    def test_seed_packages_list_query_count(self):
        self.assert_list_query_count('/openfarmplanner/api/seed-packages/', 5)

    def test_planting_plans_list_query_count(self):
        """Culture, species translations, bed and both audit users per row."""
        self.assert_list_query_count('/openfarmplanner/api/planting-plans/', 6)

    def test_tasks_list_query_count(self):
        """`planting_plan_name` renders `PlantingPlan.__str__`, which reads the
        plan's culture and bed."""
        self.assert_list_query_count('/openfarmplanner/api/tasks/', 5)

    def test_public_cultures_list_query_count(self):
        """Species translations, description translations, the species status
        behind `crop_species_status` and the active project's imported copies
        are all resolved for the whole page rather than per row."""
        self.assert_list_query_count('/openfarmplanner/api/public-cultures/', 8)

    def test_projects_list_query_count(self):
        self.assert_list_query_count('/openfarmplanner/api/projects/', 4, expected_rows=1)
