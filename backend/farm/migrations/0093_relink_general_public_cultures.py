from django.db import migrations
from django.db.models import Q


def relink_general_public_cultures(apps, _schema_editor) -> None:
    """Point species-level library entries at the project's general Kultur.

    Publishing a Sorte also creates the species-level entry when the crop has
    none yet, and used to record that entry as originating from the Sorte. The
    general Kultur was then not recognized as published, so its menu offered
    "publish" instead of "update library".
    """
    PublicCulture = apps.get_model('farm', 'PublicCulture')
    Culture = apps.get_model('farm', 'Culture')

    general_entries = (
        PublicCulture.objects
        .filter(Q(variety_normalized__isnull=True) | Q(variety_normalized=''))
        .filter(crop_species__isnull=False, source_project_culture__isnull=False)
        .exclude(
            Q(source_project_culture__variety_normalized__isnull=True)
            | Q(source_project_culture__variety_normalized=''),
        )
        .select_related('source_project_culture')
    )
    for entry in general_entries.iterator():
        variety_culture = entry.source_project_culture
        general_culture = (
            Culture.objects
            .filter(
                Q(variety_normalized__isnull=True) | Q(variety_normalized=''),
                project_id=variety_culture.project_id,
                crop_species_id=entry.crop_species_id,
            )
            .order_by('pk')
            .first()
        )
        if general_culture is None:
            continue
        PublicCulture.objects.filter(pk=entry.pk).update(
            source_project_culture=general_culture,
            source_project_id=general_culture.project_id,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0092_add_seasons'),
    ]

    operations = [
        migrations.RunPython(relink_general_public_cultures, migrations.RunPython.noop),
    ]
