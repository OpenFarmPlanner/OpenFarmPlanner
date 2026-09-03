from django.db import migrations

LEGACY_LEAF_MUSTARD_NAME = 'Senfkohl'
LEAF_MUSTARD_NAME = 'Blattsenf'

# Supplier/shop categories that bundle several botanical species (Brassica
# juncea, Brassica rapa subspecies, ...) with clearly different growing and
# harvest logic. They must not stay public mapping targets; the concrete
# species (Blattsenf, Pak Choi, Tatsoi, Mizuna, Mibuna, Komatsuna,
# Chinakohl) already exist in the seed catalogue.
COLLECTIVE_ASIAN_GREENS_NAMES = [
    'Asiatisches Blattgemüse/Senfkohl',
    'Asiatisches Blattgemüse',
    'Asiatische Blattgemüse',
    'Asiasalat',
    'Asiasalate',
    'Asia-Salat',
    'Asia-Salate',
    'Asia Salat',
    'Asia Salate',
    'Asian greens',
    'Asian salad',
]

COLLECTIVE_REVIEW_NOTE = (
    'Automatically rejected: "Asiatisches Blattgemüse/Senfkohl" and comparable '
    'Asia-greens labels are supplier categories mixing several botanical '
    'species, not a crop species. Use concrete species such as Blattsenf, '
    'Pak Choi, Tatsoi, Mizuna, Mibuna, Komatsuna or Chinakohl instead.'
)

LEAF_MUSTARD_DUPLICATE_NOTE = (
    'Automatically rejected: superseded by the "Blattsenf" leaf-mustard '
    'species. "Senfkohl" was the earlier German label for the same species '
    '(Brassica juncea); use "Blattsenf" instead.'
)


def _species_ids_for_normalized_names(apps, normalized_names):
    CropSpecies = apps.get_model('crops', 'CropSpecies')
    CropSpeciesTranslation = apps.get_model('crops', 'CropSpeciesTranslation')

    species_ids = set(
        CropSpecies.objects
        .filter(name_normalized__in=normalized_names)
        .values_list('id', flat=True)
    )
    species_ids.update(
        CropSpeciesTranslation.objects
        .filter(common_name_normalized__in=normalized_names)
        .values_list('species_id', flat=True)
    )
    return species_ids


def _rename_leaf_mustard(apps, from_name, to_name, duplicate_note=None):
    """Move the German leaf-mustard label without creating a duplicate species.

    Returns the canonical leaf-mustard species (under ``to_name``), or ``None``
    when no leaf-mustard species exists at all.
    """
    from farm.utils import normalize_text

    CropSpecies = apps.get_model('crops', 'CropSpecies')
    CropSpeciesTranslation = apps.get_model('crops', 'CropSpeciesTranslation')

    from_normalized = normalize_text(from_name) or ''
    to_normalized = normalize_text(to_name) or ''

    target = CropSpecies.objects.filter(name_normalized=to_normalized).first()
    source = CropSpecies.objects.filter(name_normalized=from_normalized).first()

    if source is not None and (target is None or target.id == source.id):
        # The usual path: rename the existing species in place. Because
        # name_normalized is unique there is no separate target to collide
        # with, so this is a plain relabel.
        source.name = to_name
        source.name_normalized = to_normalized
        source.save(update_fields=['name', 'name_normalized'])
        species = source
    else:
        # Either nothing to rename, or a separate species already carries the
        # new name. In the latter case a leftover species under the old name is
        # a superseded duplicate of the same crop, so reject it instead of
        # leaving two competing published leaf-mustard species as public
        # mapping targets.
        if source is not None and target is not None and duplicate_note and source.status == 'published':
            # Only demote an already-published duplicate. A 'proposed' source
            # is an unreviewed user submission, not this migration's to
            # reject, and an already-'rejected' one needs no change; leaving
            # both alone keeps the reverse migration a true inverse.
            source.status = 'rejected'
            source.review_note = duplicate_note
            source.save(update_fields=['status', 'review_note'])
        species = target

    if species is None:
        return None

    # update_or_create (not a filtered update) so the canonical species always
    # ends up with a matching German translation, even if it had none before.
    CropSpeciesTranslation.objects.update_or_create(
        species=species,
        language_code='de',
        defaults={
            'common_name': to_name,
            'common_name_normalized': to_normalized,
        },
    )
    return species


def replace_asian_greens_collective_species(apps, schema_editor):
    from farm.utils import normalize_text

    CropSpecies = apps.get_model('crops', 'CropSpecies')

    _rename_leaf_mustard(
        apps, LEGACY_LEAF_MUSTARD_NAME, LEAF_MUSTARD_NAME,
        duplicate_note=LEAF_MUSTARD_DUPLICATE_NOTE,
    )

    normalized_names = [
        normalize_text(name) or ''
        for name in COLLECTIVE_ASIAN_GREENS_NAMES
    ]
    species_ids = _species_ids_for_normalized_names(apps, normalized_names)
    if species_ids:
        # Only demote already-published collective categories. A 'proposed'
        # species is an unreviewed user submission that this migration must
        # not silently reject, and an already-'rejected' one keeps its
        # existing, more specific moderation note. Restricting to 'published'
        # also keeps the reverse migration a true inverse: it always
        # restores matched rows to 'published'.
        CropSpecies.objects.filter(
            id__in=species_ids,
            status='published',
        ).update(
            status='rejected',
            review_note=COLLECTIVE_REVIEW_NOTE,
        )


def restore_asian_greens_collective_species(apps, schema_editor):
    from farm.utils import normalize_text

    CropSpecies = apps.get_model('crops', 'CropSpecies')

    _rename_leaf_mustard(apps, LEAF_MUSTARD_NAME, LEGACY_LEAF_MUSTARD_NAME)

    # Undo the leaf-mustard duplicate-rejection from the dual-existence case:
    # a leftover "Senfkohl" species that was rejected as a duplicate of
    # "Blattsenf" goes back to published, matched by the note this migration
    # itself wrote so unrelated rejections are left alone. _rename_leaf_mustard
    # renamed the species back to "Senfkohl" above only when it was the sole
    # leaf-mustard species; here it is instead a second, separate species that
    # was never renamed, so it needs restoring in place.
    CropSpecies.objects.filter(
        name_normalized=normalize_text(LEGACY_LEAF_MUSTARD_NAME) or '',
        review_note=LEAF_MUSTARD_DUPLICATE_NOTE,
    ).update(status='published', review_note='')

    # Only un-reject rows this migration itself rejected (identified by the
    # note it wrote), so species that were already rejected for other reasons
    # keep their status and note.
    normalized_names = [
        normalize_text(name) or ''
        for name in COLLECTIVE_ASIAN_GREENS_NAMES
    ]
    species_ids = _species_ids_for_normalized_names(apps, normalized_names)
    if species_ids:
        CropSpecies.objects.filter(
            id__in=species_ids,
            review_note=COLLECTIVE_REVIEW_NOTE,
        ).update(status='published', review_note='')


class Migration(migrations.Migration):

    dependencies = [
        ('crops', '0010_sync_dach_crop_species_seed_data'),
    ]

    operations = [
        migrations.RunPython(
            replace_asian_greens_collective_species,
            restore_asian_greens_collective_species,
        ),
    ]
