"""Link crops that were *published* to their owned public entry.

The "Aktualisierung aus der Bibliothek" pull flow (update notice + diff dialog)
keys off ``Crop.source_public_crop`` / ``Crop.source_public_version``, which so
far only imported crops carried. Publishing now records the same link (without
``origin_type='imported'``) so a later library change to an owned entry surfaces
as a pull. This migration backfills that link for entries published earlier.

For every published/withdrawn public entry that records a ``source_project_crop``,
the project row is linked to it unless it is already linked to something else or
is itself an import. ``source_public_version`` is set to the entry's *current*
version: a divergence introduced before this migration is treated as the new
baseline (it is not recoverable here); divergences from now on surface normally.
``is_modified_from_source`` is left as-is — the field-level comparison in
``resolve_public_publish_block`` is the real gate.

Reverse only removes links this migration could have added (kept minimal: it
clears ``source_public_crop`` for non-imported rows whose entry names them as
its ``source_project_crop``).
"""

from django.db import migrations


def link_published_crops(apps, schema_editor):
    PublicCrop = apps.get_model('farm', 'PublicCrop')
    Crop = apps.get_model('farm', 'Crop')

    entries = (
        PublicCrop.objects
        .filter(status__in=('published', 'withdrawn'), source_project_crop__isnull=False)
        .select_related('source_project_crop')
        .order_by('id')
    )
    for entry in entries:
        crop = entry.source_project_crop
        if crop is None or crop.source_public_crop_id or crop.origin_type == 'imported':
            continue
        Crop.objects.filter(pk=crop.pk).update(
            source_public_crop=entry,
            source_public_version=entry.version,
        )


def unlink_published_crops(apps, schema_editor):
    PublicCrop = apps.get_model('farm', 'PublicCrop')
    Crop = apps.get_model('farm', 'Crop')

    entry_ids = list(
        PublicCrop.objects
        .filter(status__in=('published', 'withdrawn'), source_project_crop__isnull=False)
        .values_list('id', 'source_project_crop_id')
    )
    for entry_id, crop_id in entry_ids:
        Crop.objects.filter(
            pk=crop_id,
            source_public_crop_id=entry_id,
        ).exclude(origin_type='imported').update(
            source_public_crop=None,
            source_public_version=None,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0102_clear_public_variety_species_invariant_fields'),
    ]

    operations = [
        migrations.RunPython(link_published_crops, unlink_published_crops),
    ]
