from __future__ import annotations

from django.db import migrations


def _run_postgres_sql(schema_editor, sql: str) -> None:
    """Execute SQL only on PostgreSQL backends.

    This migration repairs schema drift on PostgreSQL installations. SQLite-based
    test runs must skip these statements because PostgreSQL syntax such as
    ``IF NOT EXISTS`` on ``ALTER TABLE ... ADD COLUMN`` is not supported there.
    """
    if schema_editor.connection.vendor != 'postgresql':
        return
    for statement in sql.split(';'):
        normalized = statement.strip()
        if normalized:
            schema_editor.execute(normalized)


def _has_unique_column_index(schema_editor, table_name: str, column_name: str) -> bool:
    """Return whether PostgreSQL already has a unique index for one column."""
    if schema_editor.connection.vendor != 'postgresql':
        return True
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT 1
            FROM pg_index idx
            JOIN pg_class tbl ON tbl.oid = idx.indrelid
            JOIN pg_attribute attr
              ON attr.attrelid = tbl.oid
             AND attr.attnum = ANY(idx.indkey)
            WHERE tbl.relname = %s
              AND attr.attname = %s
              AND idx.indisunique
            LIMIT 1
            """,
            [table_name, column_name],
        )
        return cursor.fetchone() is not None


def _supplier_names_are_unique(schema_editor) -> bool:
    """Return whether existing supplier names can accept a unique constraint."""
    if schema_editor.connection.vendor != 'postgresql':
        return False
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT 1
            FROM farm_supplier
            GROUP BY name
            HAVING COUNT(*) > 1
            LIMIT 1
            """,
        )
        return cursor.fetchone() is None


def repair_supplier_schema_step_one(_apps, schema_editor) -> None:
    """Apply the first PostgreSQL-only supplier schema repair step."""
    _run_postgres_sql(
        schema_editor,
        """
        ALTER TABLE farm_supplier
            ADD COLUMN IF NOT EXISTS allowed_domains jsonb;

        ALTER TABLE farm_supplier
            ADD COLUMN IF NOT EXISTS homepage_url varchar(200);

        ALTER TABLE farm_supplier
            ADD COLUMN IF NOT EXISTS slug varchar(200);

        ALTER TABLE farm_culture
            ADD COLUMN IF NOT EXISTS supplier_product_url varchar(200);

        ALTER TABLE farm_supplier
            ALTER COLUMN allowed_domains SET DEFAULT '[]'::jsonb;

        UPDATE farm_supplier
        SET allowed_domains = '[]'::jsonb
        WHERE allowed_domains IS NULL;
        """,
    )


def repair_supplier_schema_step_two(_apps, schema_editor) -> None:
    """Apply the second PostgreSQL-only supplier schema repair step."""
    _run_postgres_sql(
        schema_editor,
        """
        ALTER TABLE farm_supplier
            ALTER COLUMN homepage_url SET NOT NULL;

        ALTER TABLE farm_supplier
            ALTER COLUMN slug SET NOT NULL;

        ALTER TABLE farm_supplier
            ALTER COLUMN allowed_domains SET NOT NULL;
        """,
    )
    if not _has_unique_column_index(schema_editor, 'farm_supplier', 'slug'):
        schema_editor.execute(
            'ALTER TABLE farm_supplier '
            'ADD CONSTRAINT farm_supplier_slug_13b135c5_uniq UNIQUE (slug)'
        )
    if (
        not _has_unique_column_index(schema_editor, 'farm_supplier', 'name')
        and _supplier_names_are_unique(schema_editor)
    ):
        schema_editor.execute(
            'ALTER TABLE farm_supplier '
            'ADD CONSTRAINT farm_supplier_name_481b90a0_uniq UNIQUE (name)'
        )


def backfill_supplier_fields(apps, schema_editor) -> None:
    """Backfill supplier homepage, slug, and allowed domains after schema repair.

    :param apps: Historical app registry.
    :param schema_editor: Django schema editor.
    :return: None.
    """
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
        ('farm', '0032_supplier_domain_fields_and_culture_product_url'),
    ]

    operations = [
        migrations.RunPython(repair_supplier_schema_step_one, migrations.RunPython.noop),
        migrations.RunPython(backfill_supplier_fields, migrations.RunPython.noop),
        migrations.RunPython(repair_supplier_schema_step_two, migrations.RunPython.noop),
    ]
