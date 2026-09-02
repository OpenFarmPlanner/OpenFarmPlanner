from django.db import migrations, models


class Migration(migrations.Migration):
    """Rename the domain concept "Culture" to "Crop".

    Renames the models (and therefore their tables), the foreign keys that
    point at them (and therefore their ``*_id`` columns), and the named unique
    constraints. Every operation is a Django-level rename, so the migration is
    fully reversible.
    """

    dependencies = [
        ('farm', '0097_remove_public_culture_sowing_safety_percent'),
    ]

    operations = [
        migrations.RenameModel(old_name='Culture', new_name='Crop'),
        migrations.RenameModel(old_name='CultureSupplierData', new_name='CropSupplierData'),
        migrations.RenameModel(old_name='CultureRevision', new_name='CropRevision'),
        migrations.RenameModel(old_name='CultureImportDraft', new_name='CropImportDraft'),
        migrations.RenameModel(old_name='PublicCulture', new_name='PublicCrop'),
        migrations.RenameModel(old_name='PublicCultureTranslation', new_name='PublicCropTranslation'),
        migrations.RenameModel(old_name='PublicCultureStatusEvent', new_name='PublicCropStatusEvent'),
        migrations.RenameModel(
            old_name='PublicCultureDiscussionTopic', new_name='PublicCropDiscussionTopic'
        ),
        migrations.RenameModel(
            old_name='PublicCultureDiscussionComment', new_name='PublicCropDiscussionComment'
        ),
        migrations.RenameModel(
            old_name='PublicCultureChangeProposal', new_name='PublicCropChangeProposal'
        ),
        migrations.RenameModel(old_name='PublicCultureRevision', new_name='PublicCropRevision'),

        # Constraints reference field names, so drop them before the fields move.
        migrations.RemoveConstraint(model_name='crop', name='unique_culture_normalized'),
        migrations.RemoveConstraint(model_name='crop', name='unique_general_culture_name_per_project'),
        migrations.RemoveConstraint(
            model_name='cropsupplierdata', name='unique_culture_supplier_data_per_supplier'
        ),
        migrations.RemoveConstraint(
            model_name='publiccroptranslation', name='unique_public_culture_translation_per_language'
        ),
        migrations.RemoveConstraint(
            model_name='publiccroprevision', name='unique_public_culture_revision_version'
        ),
        migrations.RemoveConstraint(
            model_name='seedpackage', name='unique_seed_package_per_culture_size_unit'
        ),

        migrations.RenameField(
            model_name='crop', old_name='source_public_culture', new_name='source_public_crop'
        ),
        migrations.RenameField(model_name='cropsupplierdata', old_name='culture', new_name='crop'),
        migrations.RenameField(model_name='croprevision', old_name='culture', new_name='crop'),
        migrations.RenameField(model_name='seedpackage', old_name='culture', new_name='crop'),
        # The index on (project, culture) references the field by name, so it has
        # to be dropped before the rename and recreated under its new auto-name.
        migrations.RemoveIndex(model_name='plantingplan', name='farm_planti_project_73fcc9_idx'),
        migrations.RenameField(model_name='plantingplan', old_name='culture', new_name='crop'),
        migrations.AddIndex(
            model_name='plantingplan',
            index=models.Index(fields=['project', 'crop'], name='farm_planti_project_50369d_idx'),
        ),
        migrations.RenameField(
            model_name='publiccrop', old_name='source_project_culture', new_name='source_project_crop'
        ),
        migrations.RenameField(
            model_name='publiccroptranslation', old_name='public_culture', new_name='public_crop'
        ),
        migrations.RenameField(
            model_name='publiccropstatusevent', old_name='public_culture', new_name='public_crop'
        ),
        migrations.RenameField(
            model_name='publiccropdiscussiontopic', old_name='public_culture', new_name='public_crop'
        ),
        migrations.RenameField(
            model_name='publiccropchangeproposal', old_name='public_culture', new_name='public_crop'
        ),
        migrations.RenameField(
            model_name='publiccroprevision', old_name='public_culture', new_name='public_crop'
        ),

        migrations.AlterModelOptions(
            name='cropsupplierdata', options={'ordering': ['crop', 'supplier']}
        ),

        migrations.AddConstraint(
            model_name='crop',
            constraint=models.UniqueConstraint(
                condition=models.Q(('deleted_at__isnull', True)),
                fields=('name_normalized', 'variety_normalized', 'supplier'),
                name='unique_crop_normalized',
                violation_error_message='A crop with this name, variety, and supplier already exists.',
            ),
        ),
        migrations.AddConstraint(
            model_name='crop',
            constraint=models.UniqueConstraint(
                condition=models.Q(
                    ('deleted_at__isnull', True),
                    models.Q(('variety_normalized__isnull', True), ('variety_normalized', ''), _connector='OR'),
                ),
                fields=('project', 'name_normalized'),
                name='unique_general_crop_name_per_project',
                violation_error_message='A general crop with this name already exists in this project.',
            ),
        ),
        migrations.AddConstraint(
            model_name='cropsupplierdata',
            constraint=models.UniqueConstraint(
                fields=('crop', 'supplier'), name='unique_crop_supplier_data_per_supplier'
            ),
        ),
        migrations.AddConstraint(
            model_name='publiccroptranslation',
            constraint=models.UniqueConstraint(
                fields=('public_crop', 'language_code'),
                name='unique_public_crop_translation_per_language',
            ),
        ),
        migrations.AddConstraint(
            model_name='publiccroprevision',
            constraint=models.UniqueConstraint(
                fields=('public_crop', 'version'), name='unique_public_crop_revision_version'
            ),
        ),
        migrations.AddConstraint(
            model_name='seedpackage',
            constraint=models.UniqueConstraint(
                fields=('crop', 'size_value', 'size_unit'),
                name='unique_seed_package_per_crop_size_unit',
            ),
        ),
    ]
