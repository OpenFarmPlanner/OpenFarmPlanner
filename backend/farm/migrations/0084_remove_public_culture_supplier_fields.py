from django.db import migrations


def scrub_supplier_fields_from_revision_snapshots(apps, schema_editor):
    # JSONField key-lookups (e.g. has_any_keys) are Postgres-only, and this
    # migration also runs against SQLite in tests, so filter in Python.
    PublicCultureRevision = apps.get_model('farm', 'PublicCultureRevision')
    updates = []
    for revision in PublicCultureRevision.objects.all().iterator():
        if 'seed_supplier' not in revision.snapshot and 'supplier_name' not in revision.snapshot:
            continue
        revision.snapshot.pop('seed_supplier', None)
        revision.snapshot.pop('supplier_name', None)
        updates.append(revision)
        if len(updates) >= 500:
            PublicCultureRevision.objects.bulk_update(updates, ['snapshot'])
            updates = []
    if updates:
        PublicCultureRevision.objects.bulk_update(updates, ['snapshot'])

    PublicCultureChangeProposal = apps.get_model('farm', 'PublicCultureChangeProposal')
    updates = []
    for proposal in PublicCultureChangeProposal.objects.all().iterator():
        if 'seed_supplier' not in proposal.proposed_data and 'supplier_name' not in proposal.proposed_data:
            continue
        proposal.proposed_data.pop('seed_supplier', None)
        proposal.proposed_data.pop('supplier_name', None)
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
        ('farm', '0083_backfill_public_culture_translations'),
    ]

    operations = [
        migrations.RunPython(scrub_supplier_fields_from_revision_snapshots, noop_reverse),
        migrations.RemoveField(
            model_name='publicculture',
            name='seed_supplier',
        ),
        migrations.RemoveField(
            model_name='publicculture',
            name='supplier_name',
        ),
    ]
