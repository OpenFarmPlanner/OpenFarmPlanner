"""Rename "culture" in stored history records to "crop".

`EntityRevision` rows persist the entity type as a string and the entity's
field dict as JSON, so the Culture -> Crop rename has to reach the stored data
as well: otherwise history listing (which filters on `entity_type`) and
point-in-time restore (which writes snapshot keys back onto model fields) would
silently skip every pre-rename revision.
"""

from django.db import migrations

ENTITY_TYPE_RENAMES = {
    'culture': 'crop',
    'culture_supplier_data': 'crop_supplier_data',
}

# Snapshot keys are model field attnames, keyed by the entity type they belong
# to *before* the entity types themselves are renamed.
SNAPSHOT_KEY_RENAMES = {
    'culture': {'source_public_culture_id': 'source_public_crop_id'},
    'culture_supplier_data': {'culture_id': 'crop_id'},
    'planting_plan': {'culture_id': 'crop_id'},
    'seed_package': {'culture_id': 'crop_id'},
}

BATCH_SIZE = 500


def _rename_snapshot_keys(EntityRevision, entity_type: str, key_map: dict[str, str]) -> None:
    updated = []
    for revision in EntityRevision.objects.filter(entity_type=entity_type).iterator(chunk_size=BATCH_SIZE):
        snapshot = revision.snapshot
        if not isinstance(snapshot, dict) or not any(key in snapshot for key in key_map):
            continue
        revision.snapshot = {key_map.get(key, key): value for key, value in snapshot.items()}
        updated.append(revision)
        if len(updated) >= BATCH_SIZE:
            EntityRevision.objects.bulk_update(updated, ['snapshot'])
            updated = []
    if updated:
        EntityRevision.objects.bulk_update(updated, ['snapshot'])


def _apply(apps, *, type_renames: dict[str, str], key_renames: dict[str, dict[str, str]]) -> None:
    EntityRevision = apps.get_model('farm', 'EntityRevision')

    # Rewrite the snapshots first: the filters below address rows by the entity
    # type they still carry at this point.
    for entity_type, key_map in key_renames.items():
        _rename_snapshot_keys(EntityRevision, entity_type, key_map)

    for old_type, new_type in type_renames.items():
        EntityRevision.objects.filter(entity_type=old_type).update(entity_type=new_type)


def forwards(apps, schema_editor) -> None:
    _apply(apps, type_renames=ENTITY_TYPE_RENAMES, key_renames=SNAPSHOT_KEY_RENAMES)


def backwards(apps, schema_editor) -> None:
    reversed_types = {new: old for old, new in ENTITY_TYPE_RENAMES.items()}
    reversed_keys = {
        reversed_types.get(entity_type, entity_type): {new: old for old, new in key_map.items()}
        for entity_type, key_map in SNAPSHOT_KEY_RENAMES.items()
    }
    _apply(apps, type_renames=reversed_types, key_renames=reversed_keys)


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0099_rename_crop_related_names'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
