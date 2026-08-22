from django.db import migrations, models


def backfill_supplier_fields(apps, schema_editor):
    Supplier = apps.get_model('farm', 'Supplier')
    for supplier in Supplier.objects.all():
        name = (supplier.name or '').strip().lower()
        if 'reinsaat' in name:
            homepage = 'https://www.reinsaat.at'
            slug = 'reinsaat'
            domains = ['reinsaat.at']
        else:
            homepage = f"https://{(name.replace(' ', '-') or 'supplier')}.example"
            slug = (name.replace(' ', '-') or 'supplier')[:180]
            domains = []

        supplier.homepage_url = homepage
        supplier.slug = slug
        supplier.allowed_domains = domains
        supplier.save(update_fields=['homepage_url', 'slug', 'allowed_domains'])


class Migration(migrations.Migration):

    dependencies = [
        ('farm', '0031_remove_seedpackage_article_number_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='supplier',
            name='allowed_domains',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='supplier',
            name='homepage_url',
            field=models.URLField(default='https://example.com'),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='supplier',
            name='slug',
            field=models.CharField(blank=True, default='', max_length=200),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='culture',
            name='supplier_product_url',
            field=models.URLField(blank=True, null=True),
        ),
        migrations.RunPython(backfill_supplier_fields, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='supplier',
            name='slug',
            field=models.SlugField(blank=True, max_length=200, unique=True),
        ),
        migrations.AlterField(
            model_name='supplier',
            name='name',
            field=models.CharField(help_text='Supplier name', max_length=200, unique=True),
        ),
    ]
