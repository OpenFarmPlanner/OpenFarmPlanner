"""Rename "culture" to "crop" inside stored JSON payloads.

The schema rename in 0098 does not reach data that persists model field names
as JSON:

* `EntityRevision` keeps the entity type as a string plus the entity's field
  dict (`snapshot`) and the list of fields that changed (`changed_fields`).
  History listing filters on `entity_type`, point-in-time restore writes
  snapshot keys back onto model fields, and the version-history dialog drops
  any `changed_fields` entry that is missing from the snapshot — so without
  this migration every pre-rename revision would be invisible, unrestorable,
  or missing its per-field diff.
* `CropImportDraft.preview` holds the analyzed import rows that
  `apply_import_draft` reads back by key, so a draft created before the rename
  would raise on apply.
"""

from django.db import migrations

ENTITY_TYPE_RENAMES = {
    'culture': 'crop',
    'culture_supplier_data': 'crop_supplier_data',
}

# Model field attnames stored in `snapshot`/`changed_fields`, keyed by the
# entity type as it is spelled *before* the rename.
FIELD_RENAMES = {
    'culture': {'source_public_culture_id': 'source_public_crop_id'},
    'culture_supplier_data': {'culture_id': 'crop_id'},
    'planting_plan': {'culture_id': 'crop_id'},
    'seed_package': {'culture_id': 'crop_id'},
}

DRAFT_PREVIEW_RENAMES = {'matched_culture_id': 'matched_crop_id'}

BATCH_SIZE = 500


def _invert(mapping: dict[str, str]) -> dict[str, str]:
    return {value: key for key, value in mapping.items()}


def _rename_revision_fields(EntityRevision, entity_type: str, field_map: dict[str, str]) -> None:
    """Rewrite `snapshot` keys and `changed_fields` entries of one entity type."""
    updated = []
    queryset = EntityRevision.objects.filter(entity_type=entity_type)
    for revision in queryset.iterator(chunk_size=BATCH_SIZE):
        touched = False

        snapshot = revision.snapshot
        if isinstance(snapshot, dict) and any(key in snapshot for key in field_map):
            revision.snapshot = {field_map.get(key, key): value for key, value in snapshot.items()}
            touched = True

        changed_fields = revision.changed_fields
        if isinstance(changed_fields, list) and any(field in field_map for field in changed_fields):
            revision.changed_fields = [field_map.get(field, field) for field in changed_fields]
            touched = True

        if not touched:
            continue
        updated.append(revision)
        if len(updated) >= BATCH_SIZE:
            EntityRevision.objects.bulk_update(updated, ['snapshot', 'changed_fields'])
            updated = []
    if updated:
        EntityRevision.objects.bulk_update(updated, ['snapshot', 'changed_fields'])


def _rename_draft_preview_keys(CropImportDraft, key_map: dict[str, str]) -> None:
    updated = []
    for draft in CropImportDraft.objects.iterator(chunk_size=BATCH_SIZE):
        preview = draft.preview
        if not isinstance(preview, dict):
            continue
        items = preview.get('items')
        if not isinstance(items, list):
            continue
        if not any(
            isinstance(item, dict) and key in item for item in items for key in key_map
        ):
            continue
        preview['items'] = [
            {key_map.get(key, key): value for key, value in item.items()}
            if isinstance(item, dict)
            else item
            for item in items
        ]
        draft.preview = preview
        updated.append(draft)
        if len(updated) >= BATCH_SIZE:
            CropImportDraft.objects.bulk_update(updated, ['preview'])
            updated = []
    if updated:
        CropImportDraft.objects.bulk_update(updated, ['preview'])


def _apply(
    apps,
    *,
    revision_passes: list[tuple[str, dict[str, str]]],
    type_renames: dict[str, str],
    draft_renames: dict[str, str],
) -> None:
    EntityRevision = apps.get_model('farm', 'EntityRevision')

    # Rewrite the JSON first: these passes address rows by the entity type they
    # still carry at this point.
    for entity_type, field_map in revision_passes:
        _rename_revision_fields(EntityRevision, entity_type, field_map)

    for old_type, new_type in type_renames.items():
        EntityRevision.objects.filter(entity_type=old_type).update(entity_type=new_type)

    _rename_draft_preview_keys(apps.get_model('farm', 'CropImportDraft'), draft_renames)


def forwards(apps, schema_editor) -> None:
    _apply(
        apps,
        revision_passes=list(FIELD_RENAMES.items()),
        type_renames=ENTITY_TYPE_RENAMES,
        draft_renames=DRAFT_PREVIEW_RENAMES,
    )


def backwards(apps, schema_editor) -> None:
    _apply(
        apps,
        # Rows carry the renamed entity type at this point, so address them by it.
        revision_passes=[
            (ENTITY_TYPE_RENAMES.get(entity_type, entity_type), _invert(field_map))
            for entity_type, field_map in FIELD_RENAMES.items()
        ],
        type_renames=_invert(ENTITY_TYPE_RENAMES),
        draft_renames=_invert(DRAFT_PREVIEW_RENAMES),
    )


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0099_rename_crop_related_names'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
