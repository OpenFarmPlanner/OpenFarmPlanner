import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('crops', '0001_crop_species'),
        ('farm', '0076_alter_plantingplan_culture'),
    ]

    operations = [
        migrations.AddField(
            model_name='culture',
            name='crop_species',
            field=models.ForeignKey(blank=True, help_text='Optional official crop species link used when publishing to the public library.', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='project_cultures', to='crops.cropspecies'),
        ),
        migrations.AddField(
            model_name='publicculture',
            name='crop_species',
            field=models.ForeignKey(blank=True, help_text='Official crop species required for new public-library publications.', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='public_cultures', to='crops.cropspecies'),
        ),
        migrations.AddField(
            model_name='publicculture',
            name='original_language_code',
            field=models.CharField(blank=True, max_length=20),
        ),
    ]
