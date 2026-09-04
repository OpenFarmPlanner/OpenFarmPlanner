from django.db import migrations

GENERIC_FENNEL_NAME = 'Fenchel'
GENERIC_FENNEL_ENGLISH_NAME = 'Fennel'
HERB_FENNEL_NAME = 'Gewürzfenchel'
HERB_FENNEL_ENGLISH_NAME = 'Common fennel'
HERB_FENNEL_REVIEW_NOTE = (
    'Automatically renamed: generic "Fenchel" is too broad for crop-library '
    'publishing once bulb fennel and herb/seed fennel are represented as '
    'separate crop species.'
)
GENERIC_FENNEL_REJECTION_NOTE = (
    'Automatically rejected: generic "Fenchel" is too broad for crop-library '
    'publishing. Use concrete crop species such as Knollenfenchel or '
    'Gewürzfenchel instead.'
)


def _normalized(value):
    from farm.utils import normalize_text

    return normalize_text(value) or ''


def _species_ids_for_names(apps, names):
    CropSpecies = apps.get_model('crops', 'CropSpecies')
    CropSpeciesTranslation = apps.get_model('crops', 'CropSpeciesTranslation')

    normalized_names = [_normalized(name) for name in names]
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


def _write_translation(apps, species, language_code, common_name):
    CropSpeciesTranslation = apps.get_model('crops', 'CropSpeciesTranslation')

    CropSpeciesTranslation.objects.update_or_create(
        species=species,
        language_code=language_code,
        defaults={
            'common_name': common_name,
            'common_name_normalized': _normalized(common_name),
        },
    )


def replace_generic_fennel_species(apps, schema_editor):
    CropSpecies = apps.get_model('crops', 'CropSpecies')

    herb_species = CropSpecies.objects.filter(
        name_normalized=_normalized(HERB_FENNEL_NAME),
    ).first()
    generic_ids = _species_ids_for_names(
        apps,
        [GENERIC_FENNEL_NAME, GENERIC_FENNEL_ENGLISH_NAME],
    )

    if herb_species is None:
        generic_species = CropSpecies.objects.filter(id__in=generic_ids).first()
        if generic_species is None:
            herb_species = CropSpecies.objects.create(
                name=HERB_FENNEL_NAME,
                name_normalized=_normalized(HERB_FENNEL_NAME),
                status='published',
                scientific_name='Foeniculum vulgare',
                family='Apiaceae',
                categories=['herb'],
                review_note=HERB_FENNEL_REVIEW_NOTE,
            )
        else:
            generic_species.name = HERB_FENNEL_NAME
            generic_species.name_normalized = _normalized(HERB_FENNEL_NAME)
            generic_species.status = 'published'
            generic_species.scientific_name = generic_species.scientific_name or (
                'Foeniculum vulgare'
            )
            generic_species.family = generic_species.family or 'Apiaceae'
            generic_species.categories = generic_species.categories or ['herb']
            generic_species.review_note = HERB_FENNEL_REVIEW_NOTE
            generic_species.save(
                update_fields=[
                    'categories',
                    'family',
                    'name',
                    'name_normalized',
                    'review_note',
                    'scientific_name',
                    'status',
                ],
            )
            herb_species = generic_species
    else:
        herb_species.status = 'published'
        herb_species.scientific_name = herb_species.scientific_name or 'Foeniculum vulgare'
        herb_species.family = herb_species.family or 'Apiaceae'
        herb_species.categories = herb_species.categories or ['herb']
        herb_species.save(
            update_fields=[
                'categories',
                'family',
                'scientific_name',
                'status',
            ],
        )

    _write_translation(apps, herb_species, 'de', HERB_FENNEL_NAME)
    _write_translation(apps, herb_species, 'en', HERB_FENNEL_ENGLISH_NAME)

    generic_ids.discard(herb_species.id)
    if generic_ids:
        CropSpecies.objects.filter(id__in=generic_ids).update(
            status='rejected',
            review_note=GENERIC_FENNEL_REJECTION_NOTE,
        )


def restore_generic_fennel_species(apps, schema_editor):
    CropSpecies = apps.get_model('crops', 'CropSpecies')

    herb_species = CropSpecies.objects.filter(
        name_normalized=_normalized(HERB_FENNEL_NAME),
        review_note=HERB_FENNEL_REVIEW_NOTE,
    ).first()
    if herb_species is not None:
        herb_species.name = GENERIC_FENNEL_NAME
        herb_species.name_normalized = _normalized(GENERIC_FENNEL_NAME)
        herb_species.review_note = ''
        herb_species.save(update_fields=['name', 'name_normalized', 'review_note'])
        _write_translation(apps, herb_species, 'de', GENERIC_FENNEL_NAME)
        _write_translation(apps, herb_species, 'en', GENERIC_FENNEL_ENGLISH_NAME)

    generic_ids = _species_ids_for_names(
        apps,
        [GENERIC_FENNEL_NAME, GENERIC_FENNEL_ENGLISH_NAME],
    )
    if generic_ids:
        CropSpecies.objects.filter(
            id__in=generic_ids,
            review_note=GENERIC_FENNEL_REJECTION_NOTE,
        ).update(status='published', review_note='')


class Migration(migrations.Migration):

    dependencies = [
        ('crops', '0012_crop_species_metadata'),
    ]

    operations = [
        migrations.RunPython(
            replace_generic_fennel_species,
            restore_generic_fennel_species,
        ),
    ]
