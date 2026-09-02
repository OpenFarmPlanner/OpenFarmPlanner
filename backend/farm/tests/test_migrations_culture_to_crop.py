"""Round-trip coverage for the Culture -> Crop rename of stored JSON payloads.

Schema renames are checked by `makemigrations --check`; what needs a test is
`0100`, which rewrites data Django cannot rename for us: the entity types,
snapshot keys, `changed_fields` entries and import-draft previews that persist
model field names as JSON.
"""

import uuid
from datetime import timedelta

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.utils import timezone


@pytest.mark.django_db(transaction=True)
class TestCultureToCropStoredJsonMigration:
    migrate_from = ('farm', '0099_rename_crop_related_names')
    migrate_to = ('farm', '0100_rename_culture_in_stored_json')

    def setup_method(self):
        self.executor = MigrationExecutor(connection)
        self.executor.migrate([self.migrate_from])
        old_apps = self.executor.loader.project_state([self.migrate_from]).apps

        project_model = old_apps.get_model('farm', 'Project')
        revision_model = old_apps.get_model('farm', 'EntityRevision')
        draft_model = old_apps.get_model('farm', 'CropImportDraft')
        user_model = old_apps.get_model('auth', 'User')

        self.project = project_model.objects.create(name='Rename', slug='rename')
        user = user_model.objects.create(username='importer')

        self.crop_revision = revision_model.objects.create(
            project=self.project,
            entity_type='culture',
            object_id=1,
            action='updated',
            snapshot={'name': 'Tomate', 'source_public_culture_id': 7},
            changed_fields=['name', 'source_public_culture_id'],
        )
        self.plan_revision = revision_model.objects.create(
            project=self.project,
            entity_type='planting_plan',
            object_id=2,
            action='updated',
            snapshot={'culture_id': 3, 'bed_id': 4},
            changed_fields=['culture_id'],
        )
        self.supplier_data_revision = revision_model.objects.create(
            project=self.project,
            entity_type='culture_supplier_data',
            object_id=5,
            action='created',
            snapshot={'culture_id': 3, 'supplier_id': 9},
            changed_fields=['created'],
        )
        self.draft = draft_model.objects.create(
            id=uuid.uuid4(),
            project=self.project,
            created_by=user,
            checksum='x' * 64,
            preview={'items': [{'index': 0, 'action': 'update', 'matched_culture_id': 3}]},
            expires_at=timezone.now() + timedelta(hours=2),
        )

        self.executor.loader.build_graph()
        self.executor.migrate([self.migrate_to])

    def teardown_method(self):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(executor.loader.graph.leaf_nodes())

    def _models(self, state):
        apps = self.executor.loader.project_state(state).apps
        return apps.get_model('farm', 'EntityRevision'), apps.get_model('farm', 'CropImportDraft')

    def _migrate_back(self):
        self.executor.loader.build_graph()
        self.executor.migrate([self.migrate_from])
        return self._models([self.migrate_from])

    def test_entity_types_are_renamed(self):
        revision_model, _ = self._models([self.migrate_to])

        assert revision_model.objects.get(pk=self.crop_revision.pk).entity_type == 'crop'
        assert (
            revision_model.objects.get(pk=self.supplier_data_revision.pk).entity_type
            == 'crop_supplier_data'
        )
        assert revision_model.objects.get(pk=self.plan_revision.pk).entity_type == 'planting_plan'

    def test_snapshot_keys_are_renamed_per_entity_type(self):
        revision_model, _ = self._models([self.migrate_to])

        crop = revision_model.objects.get(pk=self.crop_revision.pk)
        assert crop.snapshot == {'name': 'Tomate', 'source_public_crop_id': 7}

        plan = revision_model.objects.get(pk=self.plan_revision.pk)
        assert plan.snapshot == {'crop_id': 3, 'bed_id': 4}

        supplier_data = revision_model.objects.get(pk=self.supplier_data_revision.pk)
        assert supplier_data.snapshot == {'crop_id': 3, 'supplier_id': 9}

    def test_changed_fields_are_renamed_so_the_history_diff_survives(self):
        revision_model, _ = self._models([self.migrate_to])

        crop = revision_model.objects.get(pk=self.crop_revision.pk)
        assert crop.changed_fields == ['name', 'source_public_crop_id']
        # A changed field missing from the snapshot is dropped from the version
        # history dialog, so the two must stay in step.
        assert set(crop.changed_fields) - {'created'} <= set(crop.snapshot)

        plan = revision_model.objects.get(pk=self.plan_revision.pk)
        assert plan.changed_fields == ['crop_id']

    def test_import_draft_preview_keys_are_renamed(self):
        _, draft_model = self._models([self.migrate_to])

        draft = draft_model.objects.get(pk=self.draft.pk)
        assert draft.preview['items'][0]['matched_crop_id'] == 3
        assert 'matched_culture_id' not in draft.preview['items'][0]

    def test_migration_is_reversible(self):
        revision_model, draft_model = self._migrate_back()

        crop = revision_model.objects.get(pk=self.crop_revision.pk)
        assert crop.entity_type == 'culture'
        assert crop.snapshot == {'name': 'Tomate', 'source_public_culture_id': 7}
        assert crop.changed_fields == ['name', 'source_public_culture_id']

        plan = revision_model.objects.get(pk=self.plan_revision.pk)
        assert plan.entity_type == 'planting_plan'
        assert plan.snapshot == {'culture_id': 3, 'bed_id': 4}
        assert plan.changed_fields == ['culture_id']

        supplier_data = revision_model.objects.get(pk=self.supplier_data_revision.pk)
        assert supplier_data.entity_type == 'culture_supplier_data'
        assert supplier_data.snapshot == {'culture_id': 3, 'supplier_id': 9}

        draft = draft_model.objects.get(pk=self.draft.pk)
        assert draft.preview['items'][0]['matched_culture_id'] == 3
