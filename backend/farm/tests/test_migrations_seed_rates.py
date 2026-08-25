import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


@pytest.mark.django_db(transaction=True)
class TestMethodSpecificSeedRateMigration:
    migrate_from = ('farm', '0055_reapply_seed_unit_normalization')
    migrate_to = ('farm', '0056_culture_method_specific_seed_rates')

    def setup_method(self):
        self.executor = MigrationExecutor(connection)
        self.executor.migrate([self.migrate_from])
        old_apps = self.executor.loader.project_state([self.migrate_from]).apps

        project_model = old_apps.get_model('farm', 'Project')
        culture_model = old_apps.get_model('farm', 'Culture')
        project = project_model.objects.create(name='Migration', slug='migration-seed-rate')

        culture_model.objects.create(
            name='Carrot',
            name_normalized='carrot',
            variety='Nantaise',
            growth_duration_days=90,
            harvest_duration_days=20,
            project_id=project.id,
            cultivation_types=['pre_cultivation', 'direct_sowing'],
            seed_rate_value=8,
            seed_rate_unit='g_per_m2',
            sowing_calculation_safety_percent=12,
        )

        self.executor.loader.build_graph()
        self.executor.migrate([self.migrate_to])

    def teardown_method(self):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(executor.loader.graph.leaf_nodes())

    def test_migration_copies_legacy_seed_rate_to_both_methods(self):
        apps = self.executor.loader.project_state([self.migrate_to]).apps
        culture_model = apps.get_model('farm', 'Culture')

        culture = culture_model.objects.get(name='Carrot')
        assert culture.seed_rate_direct_value == 8
        assert culture.seed_rate_direct_unit == 'g_per_m2'
        assert culture.seed_rate_pre_cultivation_value == 8
        assert culture.seed_rate_pre_cultivation_unit == 'g_per_m2'
        assert culture.sowing_calculation_safety_percent_direct == 12
        assert culture.sowing_calculation_safety_percent_pre_cultivation == 12
