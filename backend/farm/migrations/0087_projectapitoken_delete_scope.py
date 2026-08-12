from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0086_merge_agent_api_tokens_and_public_culture_rejection'),
    ]

    operations = [
        migrations.AlterField(
            model_name='projectapitoken',
            name='scope',
            field=models.CharField(
                choices=[
                    ('read', 'Read only'),
                    ('write', 'Read and write'),
                    ('delete', 'Read, write, and delete'),
                ],
                default='read',
                max_length=20,
            ),
        ),
    ]
