from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0009_public_library_contribution_consent'),
        ('farm', '0076_alter_plantingplan_culture'),
    ]

    operations = [
        migrations.CreateModel(
            name='GuestDemoSession',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField(db_index=True)),
                ('project', models.OneToOneField(on_delete=models.deletion.CASCADE, related_name='guest_demo_session', to='farm.project')),
                ('user', models.OneToOneField(on_delete=models.deletion.CASCADE, related_name='guest_demo_session', to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
