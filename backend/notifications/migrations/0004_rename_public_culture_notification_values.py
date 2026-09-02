"""Rename the stored notification values for the Culture -> Crop rename."""

from django.db import migrations, models


def _rename_values(apps, schema_editor, *, notification_type, target_type):
    Notification = apps.get_model('notifications', 'Notification')
    Notification.objects.filter(notification_type=notification_type[0]).update(
        notification_type=notification_type[1]
    )
    Notification.objects.filter(target_type=target_type[0]).update(target_type=target_type[1])


def forwards(apps, schema_editor):
    _rename_values(
        apps,
        schema_editor,
        notification_type=('public_culture_removed', 'public_crop_removed'),
        target_type=('public_culture', 'public_crop'),
    )


def backwards(apps, schema_editor):
    _rename_values(
        apps,
        schema_editor,
        notification_type=('public_crop_removed', 'public_culture_removed'),
        target_type=('public_crop', 'public_culture'),
    )


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0003_add_public_culture_removed_type"),
    ]

    operations = [
        migrations.AlterField(
            model_name="notification",
            name="notification_type",
            field=models.CharField(
                choices=[
                    (
                        "crop_species_proposal_accepted",
                        "Crop species proposal accepted",
                    ),
                    (
                        "crop_species_proposal_rejected",
                        "Crop species proposal rejected",
                    ),
                    (
                        "crop_species_proposal_submitted",
                        "Crop species proposal submitted",
                    ),
                    ("moderator_request_submitted", "Moderator request submitted"),
                    ("public_crop_removed", "Public crop removed"),
                ],
                max_length=64,
            ),
        ),
        migrations.AlterField(
            model_name="notification",
            name="target_type",
            field=models.CharField(
                blank=True,
                choices=[
                    ("public_crop", "Public crop"),
                    ("crop_species", "Crop species"),
                    ("public_library_moderation", "Public library moderation queue"),
                ],
                max_length=32,
            ),
        ),
        migrations.RunPython(forwards, backwards),
    ]
