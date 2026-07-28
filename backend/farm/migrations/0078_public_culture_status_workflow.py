import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('farm', '0077_public_publishing_metadata'),
    ]

    operations = [
        migrations.AlterField(
            model_name='publicculture',
            name='status',
            field=models.CharField(
                choices=[
                    ('draft', 'Draft'),
                    ('published', 'Published'),
                    ('withdrawn', 'Withdrawn'),
                    ('removed', 'Removed'),
                ],
                default='published',
                max_length=50,
            ),
        ),
        migrations.AddField(
            model_name='publicculture',
            name='removal_reason',
            field=models.CharField(
                blank=True,
                choices=[
                    ('accidental_publication', 'Accidental publication'),
                    ('test_data', 'Test data'),
                    ('duplicate', 'Duplicate'),
                    ('wrong_mapping', 'Wrong mapping'),
                    ('unlawful_content', 'Unlawful content'),
                    ('other', 'Other'),
                ],
                max_length=50,
            ),
        ),
        migrations.AddField(
            model_name='publicculture',
            name='status_changed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='publicculture',
            name='status_changed_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='moderated_public_cultures',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='publicculture',
            name='status_note',
            field=models.TextField(blank=True),
        ),
        migrations.CreateModel(
            name='PublicCultureStatusEvent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('from_status', models.CharField(blank=True, max_length=50)),
                ('to_status', models.CharField(max_length=50)),
                ('reason', models.CharField(blank=True, max_length=50)),
                ('note', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='public_culture_status_events', to=settings.AUTH_USER_MODEL)),
                ('public_culture', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='status_events', to='farm.publicculture')),
            ],
            options={
                'ordering': ['-created_at', '-id'],
            },
        ),
    ]
