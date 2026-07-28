from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='CropSpecies',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('name_normalized', models.CharField(db_index=True, editable=False, max_length=200, unique=True)),
                ('status', models.CharField(choices=[('published', 'Published'), ('proposed', 'Proposed')], default='published', max_length=20)),
            ],
            options={
                'verbose_name': 'Crop species',
                'verbose_name_plural': 'Crop species',
                'ordering': ['name'],
            },
        ),
    ]
