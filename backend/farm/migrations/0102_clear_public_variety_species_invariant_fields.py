"""Drop species-invariant fields from public *variety* entries.

``crop_family`` and ``nutrient_demand`` describe the crop species, so they now
live only on the species-level (general) public entry — the library UI resolves
them for a variety entry from that entry (see ``getPublicFieldValue`` in
``PublicCropLibraryPage``). Publishing a Sorte no longer writes them onto its
variety entry (see :func:`build_public_crop_payload`); this migration aligns the
entries that were published before that rule.

Only cleared where a published species-level entry exists for the same crop
species, so the value is never lost — it is already on that entry. Entries for
a species without a general entry are left untouched.

Irreversible in substance: the cleared values are not recorded here (they
remain on the species entry), so the reverse is a no-op.
"""

from django.db import migrations
from django.db.models import Q


def clear_public_variety_species_fields(apps, schema_editor):
    PublicCrop = apps.get_model('farm', 'PublicCrop')

    species_with_general_entry = set(
        PublicCrop.objects
        .filter(status='published', crop_species__isnull=False)
        .filter(Q(variety__isnull=True) | Q(variety=''))
        .values_list('crop_species_id', flat=True)
    )
    if not species_with_general_entry:
        return

    (
        PublicCrop.objects
        .filter(
            status__in=('published', 'withdrawn'),
            crop_species_id__in=species_with_general_entry,
        )
        .exclude(Q(variety__isnull=True) | Q(variety=''))
        .filter(Q(crop_family__gt='') | Q(nutrient_demand__gt=''))
        .update(crop_family='', nutrient_demand='')
    )


def noop_reverse(apps, schema_editor):
    """The values remain on the species entry; nothing to restore here."""


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0101_clear_variety_species_invariant_overrides'),
    ]

    operations = [
        migrations.RunPython(clear_public_variety_species_fields, noop_reverse),
    ]
