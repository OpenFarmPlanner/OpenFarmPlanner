from django.db import migrations, models


class Migration(migrations.Migration):
    """Add the per-user UI language preference.

    Existing rows default to 'auto' (follow the browser language), which is
    exactly the behaviour users had before this field existed — nobody had
    made an explicit choice yet, so nothing is silently overridden.
    """

    dependencies = [
        ('accounts', '0010_guestdemosession'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprojectsettings',
            name='ui_language',
            field=models.CharField(
                choices=[
                    ('auto', 'Automatic (browser language)'),
                    ('de', 'Deutsch'),
                    ('en', 'English'),
                ],
                default='auto',
                help_text="Preferred interface language; 'auto' follows the browser language.",
                max_length=10,
            ),
        ),
    ]
