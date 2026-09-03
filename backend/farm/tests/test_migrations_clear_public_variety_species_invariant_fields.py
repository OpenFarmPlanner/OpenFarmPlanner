import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


@pytest.mark.django_db(transaction=True)
class TestClearPublicVarietySpeciesInvariantFields:
    migrate_from = ('farm', '0101_clear_variety_species_invariant_overrides')
    migrate_to = ('farm', '0102_clear_public_variety_species_invariant_fields')

    def setup_method(self):
        self.executor = MigrationExecutor(connection)
        self.executor.migrate([self.migrate_from])
        old_apps = self.executor.loader.project_state([self.migrate_from]).apps

        public_crop = old_apps.get_model('farm', 'PublicCrop')
        species_model = old_apps.get_model('crops', 'CropSpecies')

        with_general = species_model.objects.create(name='Solanum lycopersicum')
        without_general = species_model.objects.create(name='Daucus carota')

        public_crop.objects.create(
            name='Tomate', name_normalized='tomate', variety='', status='published',
            crop_species_id=with_general.id, crop_family='Solanaceae', nutrient_demand='high',
        )
        self.linked_variety_id = public_crop.objects.create(
            name='Tomate', name_normalized='tomate', variety='Matina', variety_normalized='matina',
            status='published', crop_species_id=with_general.id,
            crop_family='Solanaceae', nutrient_demand='high',
        ).id
        self.orphan_variety_id = public_crop.objects.create(
            name='Karotte', name_normalized='karotte',
            variety='Nantaise', variety_normalized='nantaise',
            status='published', crop_species_id=without_general.id,
            crop_family='Apiaceae', nutrient_demand='low',
        ).id
        self.general_id = public_crop.objects.get(variety='', crop_species_id=with_general.id).id

        self.executor.loader.build_graph()
        self.executor.migrate([self.migrate_to])

    def teardown_method(self):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(executor.loader.graph.leaf_nodes())

    def test_clears_only_variety_entries_backed_by_a_species_entry(self):
        apps = self.executor.loader.project_state([self.migrate_to]).apps
        public_crop = apps.get_model('farm', 'PublicCrop')

        linked = public_crop.objects.get(id=self.linked_variety_id)
        assert linked.crop_family == ''
        assert linked.nutrient_demand == ''

        # No species-level entry -> the value is the only copy, so it stays.
        orphan = public_crop.objects.get(id=self.orphan_variety_id)
        assert orphan.crop_family == 'Apiaceae'
        assert orphan.nutrient_demand == 'low'

        general = public_crop.objects.get(id=self.general_id)
        assert general.crop_family == 'Solanaceae'
        assert general.nutrient_demand == 'high'
