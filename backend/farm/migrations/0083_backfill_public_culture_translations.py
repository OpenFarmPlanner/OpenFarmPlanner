"""Move each public entry's existing description into a translation row.

Migration assumptions:

1. ``PublicCulture.notes`` is the entry's public description in exactly one
   language. That language is ``original_language_code`` when the publisher
   picked one in the publishing wizard, and ``de`` otherwise (everything
   published before this change went through a German-only UI).
2. ``notes`` is **not** cleared. It stays as the original-language copy so the
   existing import-into-project path and any consumer that has not been
   updated keep working; the translation row is the multi-language source of
   truth going forward.
3. No English text is generated. An entry that only has German prose stays
   German-only, and the API reports which language it actually returned so the
   UI can say so instead of mislabelling it.

Empty descriptions produce no row — a blank translation carries no
information and would only make "has a translation" checks lie.

Re-running is safe (rows are keyed on public_culture + language_code) and the
reverse operation only removes translation rows, never the original ``notes``.
"""

from django.db import migrations

SUPPORTED_LANGUAGE_CODES = {'de', 'en'}
LEGACY_LANGUAGE_CODE = 'de'


def backfill_translations(apps, schema_editor):
    PublicCulture = apps.get_model('farm', 'PublicCulture')
    PublicCultureTranslation = apps.get_model('farm', 'PublicCultureTranslation')

    existing = {
        (row.public_culture_id, row.language_code)
        for row in PublicCultureTranslation.objects.all().only('public_culture_id', 'language_code')
    }

    new_rows = []
    queryset = PublicCulture.objects.all().only('id', 'notes', 'original_language_code')
    for public_culture in queryset.iterator():
        description = (public_culture.notes or '').strip()
        if not description:
            continue
        language_code = (public_culture.original_language_code or '').strip().lower()
        if language_code not in SUPPORTED_LANGUAGE_CODES:
            language_code = LEGACY_LANGUAGE_CODE
        if (public_culture.id, language_code) in existing:
            continue
        new_rows.append(PublicCultureTranslation(
            public_culture_id=public_culture.id,
            language_code=language_code,
            description=description,
        ))

    PublicCultureTranslation.objects.bulk_create(new_rows, batch_size=500)


def drop_translations(apps, schema_editor):
    PublicCultureTranslation = apps.get_model('farm', 'PublicCultureTranslation')
    PublicCultureTranslation.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0082_add_crop_translations'),
    ]

    operations = [
        migrations.RunPython(backfill_translations, drop_translations),
    ]
