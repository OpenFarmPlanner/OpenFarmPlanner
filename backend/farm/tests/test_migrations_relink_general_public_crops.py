import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

# The crops tables are not rolled back together with farm's, so species rows are
# created through the current model instead of a historical one.
from crops.models import CropSpecies


@pytest.mark.django_db(transaction=True)
class TestRelinkGeneralPublicCropsMigration:
    """The backfill for species-level entries created by a Sorte publish.

    They used to record the Sorte as their origin, which left the project's
    general Kultur looking unpublished.
    """

    migrate_from = ('farm', '0092_add_seasons')
    migrate_to = ('farm', '0093_relink_general_public_cultures')

    def setup_method(self):
        self.executor = MigrationExecutor(connection)
        self.executor.migrate([self.migrate_from])
        old_apps = self.executor.loader.project_state([self.migrate_from]).apps

        project_model = old_apps.get_model('farm', 'Project')
        crop_model = old_apps.get_model('farm', 'Culture')
        public_crop_model = old_apps.get_model('farm', 'PublicCulture')

        project = project_model.objects.create(name='Migration Project', slug='migration-project')
        species = CropSpecies.objects.create(name='Lettuce')
        other_species = CropSpecies.objects.create(name='Carrot')

        self.general_crop = crop_model.objects.create(
            name='Lettuce',
            name_normalized='lettuce',
            variety='',
            variety_normalized=None,
            crop_species_id=species.id,
            project_id=project.id,
        )
        self.variety_crop = crop_model.objects.create(
            name='Lettuce',
            name_normalized='lettuce',
            variety='Bijella',
            variety_normalized='bijella',
            crop_species_id=species.id,
            project_id=project.id,
        )
        self.orphan_variety_crop = crop_model.objects.create(
            name='Carrot',
            name_normalized='carrot',
            variety='Nantes',
            variety_normalized='nantes',
            crop_species_id=other_species.id,
            project_id=project.id,
        )

        self.general_entry = public_crop_model.objects.create(
            name='Lettuce',
            name_normalized='lettuce',
            variety='',
            variety_normalized='',
            status='published',
            crop_species_id=species.id,
            source_project_culture_id=self.variety_crop.id,
            source_project_id=project.id,
        )
        self.variety_entry = public_crop_model.objects.create(
            name='Lettuce',
            name_normalized='lettuce',
            variety='Bijella',
            variety_normalized='bijella',
            status='published',
            crop_species_id=species.id,
            source_project_culture_id=self.variety_crop.id,
            source_project_id=project.id,
        )
        self.orphan_general_entry = public_crop_model.objects.create(
            name='Carrot',
            name_normalized='carrot',
            variety='',
            variety_normalized='',
            status='published',
            crop_species_id=other_species.id,
            source_project_culture_id=self.orphan_variety_crop.id,
            source_project_id=project.id,
        )

        self.executor.loader.build_graph()
        self.executor.migrate([self.migrate_to])

    def teardown_method(self):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(executor.loader.graph.leaf_nodes())

    def _public_crop_model(self):
        apps = self.executor.loader.project_state([self.migrate_to]).apps
        return apps.get_model('farm', 'PublicCulture')

    def test_general_entry_is_relinked_to_the_projects_general_kultur(self):
        entry = self._public_crop_model().objects.get(pk=self.general_entry.pk)

        assert entry.source_project_culture_id == self.general_crop.id

    def test_variety_entry_keeps_its_own_sorte(self):
        entry = self._public_crop_model().objects.get(pk=self.variety_entry.pk)

        assert entry.source_project_culture_id == self.variety_crop.id

    def test_general_entry_without_a_local_kultur_is_left_alone(self):
        entry = self._public_crop_model().objects.get(pk=self.orphan_general_entry.pk)

        assert entry.source_project_culture_id == self.orphan_variety_crop.id
