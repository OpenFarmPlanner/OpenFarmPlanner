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


def _rename_leaf_mustard(apps, from_name, to_name):
    """Move the German leaf-mustard label without creating a duplicate species."""
    from farm.utils import normalize_text

    CropSpecies = apps.get_model('crops', 'CropSpecies')
    CropSpeciesTranslation = apps.get_model('crops', 'CropSpeciesTranslation')

    from_normalized = normalize_text(from_name) or ''
    to_normalized = normalize_text(to_name) or ''

    target = CropSpecies.objects.filter(name_normalized=to_normalized).first()
    source = CropSpecies.objects.filter(name_normalized=from_normalized).first()
    if source is None or (target is not None and target.id != source.id):
        # Nothing to rename, or a species under the new name already exists
        # (fresh databases: the seed sync migration created it directly).
        species = target
    else:
        source.name = to_name
        source.name_normalized = to_normalized
        source.save(update_fields=['name', 'name_normalized'])
        species = source

    if species is None:
        return

    CropSpeciesTranslation.objects.filter(
        species=species,
        language_code='de',
    ).update(
        common_name=to_name,
        common_name_normalized=to_normalized,
    )


def replace_asian_greens_collective_species(apps, schema_editor):
    from farm.utils import normalize_text

    CropSpecies = apps.get_model('crops', 'CropSpecies')

    _rename_leaf_mustard(apps, LEGACY_LEAF_MUSTARD_NAME, LEAF_MUSTARD_NAME)

    normalized_names = [
        normalize_text(name) or ''
        for name in COLLECTIVE_ASIAN_GREENS_NAMES
    ]
    species_ids = _species_ids_for_normalized_names(apps, normalized_names)
    if species_ids:
        CropSpecies.objects.filter(id__in=species_ids).update(
            status='rejected',
            review_note=COLLECTIVE_REVIEW_NOTE,
        )


def restore_asian_greens_collective_species(apps, schema_editor):
    _rename_leaf_mustard(apps, LEAF_MUSTARD_NAME, LEGACY_LEAF_MUSTARD_NAME)


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
