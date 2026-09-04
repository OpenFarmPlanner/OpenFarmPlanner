import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


@pytest.mark.django_db(transaction=True)
class TestLinkPublishedCropsToOwnedEntries:
    migrate_from = ('farm', '0102_clear_public_variety_species_invariant_fields')
    migrate_to = ('farm', '0103_link_published_crops_to_owned_entries')

    def setup_method(self):
        self.executor = MigrationExecutor(connection)
        self.executor.migrate([self.migrate_from])
        old_apps = self.executor.loader.project_state([self.migrate_from]).apps

        project_model = old_apps.get_model('farm', 'Project')
        crop_model = old_apps.get_model('farm', 'Crop')
        public_crop = old_apps.get_model('farm', 'PublicCrop')

        project = project_model.objects.create(name='P', slug='p')

        self.published_crop_id = crop_model.objects.create(
            name='Lettuce', name_normalized='lettuce', project=project,
        ).id
        self.published_entry_id = public_crop.objects.create(
            name='Lettuce', name_normalized='lettuce', variety='Bijella',
            variety_normalized='bijella', status='published', version=4,
            source_project=project, source_project_crop_id=self.published_crop_id,
        ).id

        self.imported_crop_id = crop_model.objects.create(
            name='Carrot', name_normalized='carrot', project=project,
            origin_type='imported',
        ).id
        public_crop.objects.create(
            name='Carrot', name_normalized='carrot', variety='Mokum',
            variety_normalized='mokum', status='published', version=2,
            source_project=project, source_project_crop_id=self.imported_crop_id,
        )

        self.executor.loader.build_graph()
        self.executor.migrate([self.migrate_to])

    def teardown_method(self):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(executor.loader.graph.leaf_nodes())

    def test_links_published_crop_and_skips_imports(self):
        apps = self.executor.loader.project_state([self.migrate_to]).apps
        crop_model = apps.get_model('farm', 'Crop')

        published = crop_model.objects.get(id=self.published_crop_id)
        assert published.source_public_crop_id == self.published_entry_id
        assert published.source_public_version == 4

        imported = crop_model.objects.get(id=self.imported_crop_id)
        assert imported.source_public_crop_id is None
