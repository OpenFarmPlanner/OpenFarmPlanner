import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


@pytest.mark.django_db(transaction=True)
class TestCropSpeciesMetadataMigration:
    migrate_from = [
        ('farm', '0102_clear_public_variety_species_invariant_fields'),
        ('crops', '0011_replace_asian_greens_collective_species'),
    ]
    migrate_to = [
        ('farm', '0102_clear_public_variety_species_invariant_fields'),
        ('crops', '0012_crop_species_metadata'),
    ]

    def setup_method(self):
        self.executor = MigrationExecutor(connection)
        self.executor.migrate(self.migrate_from)
        old_apps = self.executor.loader.project_state(self.migrate_from).apps

        species_model = old_apps.get_model('crops', 'CropSpecies')
        translation_model = old_apps.get_model('crops', 'CropSpeciesTranslation')
        project_model = old_apps.get_model('farm', 'Project')
        crop_model = old_apps.get_model('farm', 'Crop')
        public_crop_model = old_apps.get_model('farm', 'PublicCrop')

        self.species, _ = species_model.objects.update_or_create(
            name_normalized='blattsenf',
            defaults={'name': 'Blattsenf'},
        )
        project = project_model.objects.create(
            name='Metadata Migration Project',
            slug='metadata-migration-project',
        )
        custom_project = project_model.objects.create(
            name='Custom Metadata Migration Project',
            slug='custom-metadata-migration-project',
        )
        crop_model.objects.create(
            project=custom_project,
            crop_species=self.species,
            name='Blattsenf',
            variety='',
            name_normalized='blattsenf',
            crop_family='',
        )
        crop_model.objects.create(
            project=project,
            crop_species=self.species,
            name='Blattsenf',
            variety='Grün im Schnee',
            name_normalized='blattsenf',
            variety_normalized='grun im schnee',
            crop_family='Stale variety family',
        )
        crop_model.objects.create(
            project=project,
            crop_species=self.species,
            name='Blattsenf',
            variety='',
            name_normalized='blattsenf',
            crop_family='Custom family',
        )
        public_crop_model.objects.create(
            crop_species=self.species,
            name='Blattsenf',
            variety='',
            name_normalized='blattsenf',
            status='published',
            version=1,
            crop_family='',
        )
        translation_model.objects.update_or_create(
            species=self.species,
            language_code='en',
            defaults={
                'common_name': 'Mustard greens',
                'common_name_normalized': 'mustard greens',
            },
        )

        self.executor.loader.build_graph()
        self.executor.migrate(self.migrate_to)
        self.new_apps = self.executor.loader.project_state(self.migrate_to).apps

    def teardown_method(self):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(executor.loader.graph.leaf_nodes())

    def test_populates_seeded_species_metadata(self):
        species_model = self.new_apps.get_model('crops', 'CropSpecies')

        species = species_model.objects.get(name_normalized='blattsenf')

        assert species.scientific_name == 'Brassica juncea'
        assert species.family == 'Brassicaceae'
        assert species.categories == ['vegetable']

    def test_fills_only_blank_general_project_crop_family(self):
        crop_model = self.new_apps.get_model('farm', 'Crop')

        assert crop_model.objects.filter(
            name='Blattsenf',
            variety='',
            crop_family='Brassicaceae',
        ).exists()
        assert crop_model.objects.filter(
            name='Blattsenf',
            variety='',
            crop_family='Custom family',
        ).exists()
        assert crop_model.objects.filter(
            name='Blattsenf',
            variety='Grün im Schnee',
            crop_family='Stale variety family',
        ).exists()

    def test_fills_blank_general_public_crop_family(self):
        public_crop_model = self.new_apps.get_model('farm', 'PublicCrop')

        assert public_crop_model.objects.filter(
            name='Blattsenf',
            variety='',
            crop_family='Brassicaceae',
        ).exists()
