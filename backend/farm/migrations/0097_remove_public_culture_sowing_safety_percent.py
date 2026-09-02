from django.db import migrations


def scrub_safety_percent_from_public_culture_history(apps, schema_editor):
    # JSONField key-lookups (e.g. has_key) are Postgres-only, and this migration
    # also runs against SQLite in tests, so filter in Python.
    field = 'sowing_calculation_safety_percent'

    PublicCultureRevision = apps.get_model('farm', 'PublicCultureRevision')
    updates = []
    for revision in PublicCultureRevision.objects.all().iterator():
        if field not in revision.snapshot:
            continue
        revision.snapshot.pop(field, None)
        updates.append(revision)
        if len(updates) >= 500:
            PublicCultureRevision.objects.bulk_update(updates, ['snapshot'])
            updates = []
    if updates:
        PublicCultureRevision.objects.bulk_update(updates, ['snapshot'])

    PublicCultureChangeProposal = apps.get_model('farm', 'PublicCultureChangeProposal')
    updates = []
    for proposal in PublicCultureChangeProposal.objects.all().iterator():
        if field not in proposal.proposed_data:
            continue
        proposal.proposed_data.pop(field, None)
        updates.append(proposal)
        if len(updates) >= 500:
            PublicCultureChangeProposal.objects.bulk_update(updates, ['proposed_data'])
            updates = []
    if updates:
        PublicCultureChangeProposal.objects.bulk_update(updates, ['proposed_data'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0096_feedback'),
    ]

    operations = [
        migrations.RunPython(scrub_safety_percent_from_public_culture_history, noop_reverse),
        migrations.RemoveField(
            model_name='publicculture',
            name='sowing_calculation_safety_percent',
        ),
    ]
