from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from accounts.consent import CURRENT_VERSIONS, REQUIRED_DOCUMENTS
from accounts.models import DocumentConsent, UserProjectSettings
from farm.models import (
    Bed,
    BedLayout,
    Culture,
    CultureSupplierData,
    Field,
    FieldLayout,
    Location,
    PlantingPlan,
    Project,
    ProjectInvitation,
    ProjectMembership,
    Supplier,
)
from farm.seed_units import (
    SEED_PACKAGE_UNIT_GRAMS,
    SEED_PACKAGE_UNIT_SEEDS,
    SEED_RATE_UNIT_G_PER_LFM,
    SEED_RATE_UNIT_G_PER_M2,
    SEED_RATE_UNIT_SEEDS_PER_M2,
    SEED_RATE_UNIT_SEEDS_PER_PLANT,
)
from farm.services.demo_project import reset_project_demo_data
from farm.services.seasons import assign_unassigned_planting_plans

User = get_user_model()

HINT_TEST_PROJECT_NAME = 'Hinweise & Sonderfälle'
HINT_TEST_PROJECT_SLUG = 'hinweise-sonderfaelle'
HINT_TEST_PROJECT_DESCRIPTION = (
    'Reproduzierbares Testprojekt für Hinweise, Warnungen und Sonderfälle.'
)
HINT_TEST_USER_EMAIL = 'hint-test-openfarmplanner@example.local'
HINT_TEST_USERNAME = 'openfarmplanner-hint-test'
HINT_TEST_PASSWORD = 'OpenFarmPlannerHintTest2026!'
HINT_TEST_MEMBER_EMAIL = 'hint-test-member@example.local'
HINT_TEST_MEMBER_USERNAME = 'openfarmplanner-hint-test-member'
HINT_TEST_MEMBER_PASSWORD = 'OpenFarmPlannerHintMember2026!'
HINT_TEST_INVITATION_EMAIL = 'hint-test-invitation@example.local'


@dataclass(frozen=True)
class HintTestProjectResult:
    project: Project
    user: Any
    member_user: Any
    created_project: bool
    created_user: bool
    created_member_user: bool


def create_or_reset_hint_test_project(
    *,
    user_email: str = HINT_TEST_USER_EMAIL,
    username: str = HINT_TEST_USERNAME,
    password: str = HINT_TEST_PASSWORD,
    member_email: str = HINT_TEST_MEMBER_EMAIL,
    member_username: str = HINT_TEST_MEMBER_USERNAME,
    member_password: str = HINT_TEST_MEMBER_PASSWORD,
    project_name: str = HINT_TEST_PROJECT_NAME,
    project_slug: str = HINT_TEST_PROJECT_SLUG,
) -> HintTestProjectResult:
    """Create a deterministic visual QA project and replace its project data."""
    with transaction.atomic():
        user, created_user = _get_or_create_user(
            email=user_email,
            username=username,
            password=password,
        )
        member_user, created_member_user = _get_or_create_user(
            email=member_email,
            username=member_username,
            password=member_password,
        )
        project, created_project = Project.objects.get_or_create(
            slug=project_slug,
            defaults={
                'name': project_name,
                'description': HINT_TEST_PROJECT_DESCRIPTION,
            },
        )
        if not created_project:
            project.name = project_name
            project.description = HINT_TEST_PROJECT_DESCRIPTION
            project.deleted_at = None
            project.is_active = True
            project.save(
                update_fields=['name', 'description', 'deleted_at', 'is_active', 'updated_at']
            )

        ProjectMembership.objects.update_or_create(
            user=user,
            project=project,
            defaults={'role': ProjectMembership.ROLE_ADMIN},
        )
        ProjectMembership.objects.update_or_create(
            user=member_user,
            project=project,
            defaults={'role': ProjectMembership.ROLE_MEMBER},
        )
        _apply_project_settings(user=user, project=project)
        _apply_project_settings(user=member_user, project=project)
        _ensure_required_consents(user)
        _ensure_required_consents(member_user)

        populate_hint_test_project(project, owner=user)

    return HintTestProjectResult(
        project=project,
        user=user,
        member_user=member_user,
        created_project=created_project,
        created_user=created_user,
        created_member_user=created_member_user,
    )


def populate_hint_test_project(project: Project, *, owner: Any | None = None) -> None:
    """Replace one project's farm data with the hint and edge-case fixtures."""
    with transaction.atomic():
        reset_project_demo_data(project)
        ProjectInvitation.objects.filter(project=project).delete()

        suppliers = _create_suppliers(project)
        locations, fields, beds = _create_area_hierarchy(project)
        _create_layouts(project, locations, fields, beds)
        cultures = _create_cultures(project, suppliers)
        _create_supplier_data(project, cultures, suppliers)
        _create_planting_plans(project, cultures, beds, owner)
        assign_unassigned_planting_plans(project, owner=owner)
        _create_invitation(project, owner)


def _get_or_create_user(*, email: str, username: str, password: str) -> tuple[Any, bool]:
    user, created_user = User.objects.get_or_create(
        email=email,
        defaults={
            'username': username,
            'is_active': True,
        },
    )
    if created_user:
        user.set_password(password)
        user.save(update_fields=['password'])
    elif password:
        user.set_password(password)
        if not user.username:
            user.username = username
            user.save(update_fields=['password', 'username'])
        else:
            user.save(update_fields=['password'])
    return user, created_user


def _apply_project_settings(*, user: Any, project: Project) -> None:
    settings_obj, _ = UserProjectSettings.objects.get_or_create(user=user)
    settings_obj.default_project = project
    settings_obj.last_project = project
    settings_obj.save(update_fields=['default_project', 'last_project', 'updated_at'])


def _ensure_required_consents(user: Any) -> None:
    for document in REQUIRED_DOCUMENTS:
        current_version = CURRENT_VERSIONS[document]
        if not DocumentConsent.objects.filter(
            user=user,
            document=document,
            version=current_version,
        ).exists():
            DocumentConsent.objects.create(
                user=user,
                document=document,
                version=current_version,
            )


def _create_suppliers(project: Project) -> dict[str, Supplier]:
    specs = {
        'complete': (
            'Lieferant – vollständige Bestelldaten',
            'https://hint-complete.example',
        ),
        'secondary': (
            'Lieferant – alternative TKG',
            'https://hint-tkg.example',
        ),
        'empty_order': (
            'Lieferant – ohne Bestellinformationen',
            'https://hint-no-order.example',
        ),
    }
    return {
        key: Supplier.objects.create(name=name, homepage_url=url, project=project)
        for key, (name, url) in specs.items()
    }


def _create_area_hierarchy(
    project: Project,
) -> tuple[dict[str, Location], dict[str, Field], dict[str, Bed]]:
    locations = {
        'complete': Location.objects.create(
            name='Hinweise – vollständiger Standort',
            description='Referenzstandort mit vollständigen optionalen Angaben.',
            soil_type='loam',
            exposure='south',
            latitude=48.2082,
            longitude=16.3738,
            project=project,
        ),
        'missing_optional': Location.objects.create(
            name='Hinweise – Standort ohne optionale Angaben',
            description='Absichtlich ohne Boden, Exposition und Koordinaten.',
            project=project,
        ),
    }

    fields = {
        'complete': Field.objects.create(
            name='Parzelle – vollständige Flächenangaben',
            location=locations['complete'],
            length_m=20,
            width_m=5,
            notes='Vollständig berechenbare Fläche.',
            project=project,
        ),
        'missing_area': Field.objects.create(
            name='Parzelle – Fläche fehlt',
            location=locations['missing_optional'],
            notes='Absichtlich ohne Fläche und Abmessungen.',
            project=project,
        ),
        'conflict': Field.objects.create(
            name='Parzelle – Konfliktprüfung',
            location=locations['complete'],
            length_m=3,
            width_m=1,
            notes='Kleine Fläche für Belegungs- und Warnzustände.',
            project=project,
        ),
    }

    beds = {
        'complete': Bed.objects.create(
            name='Beet – vollständige Fläche',
            field=fields['complete'],
            length_m=10,
            width_m=1.2,
            project=project,
        ),
        'missing_area': Bed.objects.create(
            name='Beet – keine nutzbare Fläche',
            field=fields['missing_area'],
            notes='Absichtlich ohne Fläche und Abmessungen.',
            project=project,
        ),
        'conflict': Bed.objects.create(
            name='Beet – überbelegt',
            field=fields['conflict'],
            length_m=2,
            width_m=0.5,
            project=project,
        ),
    }
    return locations, fields, beds


def _create_layouts(
    project: Project,
    locations: dict[str, Location],
    fields: dict[str, Field],
    beds: dict[str, Bed],
) -> None:
    FieldLayout.objects.create(
        project=project,
        location=locations['complete'],
        field=fields['complete'],
        x=32,
        y=32,
        scale=1,
    )
    FieldLayout.objects.create(
        project=project,
        location=locations['complete'],
        field=fields['conflict'],
        x=260,
        y=32,
        scale=1,
    )
    BedLayout.objects.create(
        project=project,
        location=locations['complete'],
        bed=beds['complete'],
        x=16,
        y=16,
        scale=1,
    )
    BedLayout.objects.create(
        project=project,
        location=locations['complete'],
        bed=beds['conflict'],
        x=18,
        y=18,
        scale=1,
    )


def _create_cultures(project: Project, suppliers: dict[str, Supplier]) -> dict[str, Culture]:
    base_kwargs = {
        'growth_duration_days': 45,
        'harvest_duration_days': 14,
        'propagation_duration_days': 21,
        'row_spacing_m': 0.3,
        'distance_within_row_m': 0.25,
        'expected_yield': Decimal('2.50'),
        'harvest_method': 'per_sqm',
        'cultivation_types': ['direct_sowing'],
        'sowing_calculation_safety_percent_direct': 0,
    }
    culture_specs: dict[str, dict[str, Any]] = {
        'complete': {
            **base_kwargs,
            'name': 'Saatgutmenge – vollständig berechenbar',
            'variety': 'Kontrollfall',
            'seed_rate_direct_value': 10,
            'seed_rate_direct_unit': SEED_RATE_UNIT_G_PER_M2,
            'supplier': suppliers['complete'],
            'selected_seed_demand_supplier': suppliers['complete'],
            'display_color': '#2f7d32',
        },
        'missing_seed_rate': {
            **base_kwargs,
            'name': 'Saatgutmenge – Aussaatmenge fehlt',
            'variety': 'Saatgutwarnung',
            'supplier': suppliers['complete'],
            'selected_seed_demand_supplier': suppliers['complete'],
            'display_color': '#c77d00',
        },
        'missing_area': {
            **base_kwargs,
            'name': 'Saatgutmenge – Beetfläche fehlt',
            'variety': 'Flächenwarnung',
            'seed_rate_direct_value': 8,
            'seed_rate_direct_unit': SEED_RATE_UNIT_G_PER_M2,
            'supplier': suppliers['complete'],
            'selected_seed_demand_supplier': suppliers['complete'],
            'display_color': '#d89b22',
        },
        'missing_row_spacing': {
            **base_kwargs,
            'name': 'Saatgutmenge – Reihenabstand fehlt',
            'variety': 'Laufmeterwarnung',
            'seed_rate_direct_value': 2,
            'seed_rate_direct_unit': SEED_RATE_UNIT_G_PER_LFM,
            'row_spacing_m': None,
            'supplier': suppliers['complete'],
            'selected_seed_demand_supplier': suppliers['complete'],
            'display_color': '#b66d12',
        },
        'missing_quantity': {
            **base_kwargs,
            'name': 'Saatgutmenge – Pflanzenanzahl fehlt',
            'variety': 'Jungpflanzenwarnung',
            'cultivation_types': ['pre_cultivation'],
            'cultivation_type': 'pre_cultivation',
            'seed_rate_pre_cultivation_value': 2,
            'seed_rate_pre_cultivation_unit': SEED_RATE_UNIT_SEEDS_PER_PLANT,
            'supplier': suppliers['complete'],
            'selected_seed_demand_supplier': suppliers['complete'],
            'display_color': '#b45309',
        },
        'missing_tkg': {
            **base_kwargs,
            'name': 'Saatgutmenge – TKG fehlt',
            'variety': 'Umrechnungswarnung',
            'seed_rate_direct_value': 1000,
            'seed_rate_direct_unit': SEED_RATE_UNIT_SEEDS_PER_M2,
            'supplier': suppliers['complete'],
            'selected_seed_demand_supplier': suppliers['complete'],
            'display_color': '#9a3412',
        },
        'missing_supplier': {
            **base_kwargs,
            'name': 'Saatgutmenge – Lieferant fehlt',
            'variety': 'Bestelldatenwarnung',
            'seed_rate_direct_value': 5,
            'seed_rate_direct_unit': SEED_RATE_UNIT_G_PER_M2,
            'display_color': '#7c2d12',
        },
        'choose_supplier': {
            **base_kwargs,
            'name': 'Saatgutmenge – Lieferant auswählen',
            'variety': 'Mehrfachauswahl',
            'seed_rate_direct_value': 4,
            'seed_rate_direct_unit': SEED_RATE_UNIT_G_PER_M2,
            'supplier': suppliers['complete'],
            'display_color': '#0f766e',
        },
        'supplier_tkg_override': {
            **base_kwargs,
            'name': 'Saatgutmenge – Lieferanten-TKG überschreibt Kultur',
            'variety': 'Override',
            'seed_rate_direct_value': 1000,
            'seed_rate_direct_unit': SEED_RATE_UNIT_SEEDS_PER_M2,
            'thousand_kernel_weight_g': Decimal('10.00'),
            'supplier': suppliers['secondary'],
            'selected_seed_demand_supplier': suppliers['secondary'],
            'display_color': '#0369a1',
        },
        'germination_rate': {
            **base_kwargs,
            'name': 'Saatgutmenge – Keimrate erhöht Bedarf',
            'variety': 'Keimquote',
            'seed_rate_direct_value': 6,
            'seed_rate_direct_unit': SEED_RATE_UNIT_G_PER_M2,
            'supplier': suppliers['complete'],
            'selected_seed_demand_supplier': suppliers['complete'],
            'display_color': '#4d7c0f',
        },
        'no_timing': {
            **base_kwargs,
            'name': 'Kultur – keine Zeitangaben',
            'variety': 'Erntedatum offen',
            'growth_duration_days': None,
            'harvest_duration_days': None,
            'seed_rate_direct_value': 3,
            'seed_rate_direct_unit': SEED_RATE_UNIT_G_PER_M2,
            'supplier': suppliers['complete'],
            'selected_seed_demand_supplier': suppliers['complete'],
            'display_color': '#9333ea',
        },
        'partial_timing': {
            **base_kwargs,
            'name': 'Kultur – nur Wachstumszeit',
            'variety': 'Ernteende offen',
            'growth_duration_days': 35,
            'harvest_duration_days': None,
            'seed_rate_direct_value': 3,
            'seed_rate_direct_unit': SEED_RATE_UNIT_G_PER_M2,
            'supplier': suppliers['complete'],
            'selected_seed_demand_supplier': suppliers['complete'],
            'display_color': '#7e22ce',
        },
        'complete_timing': {
            **base_kwargs,
            'name': 'Kultur – vollständige Zeitangaben',
            'variety': 'Referenz',
            'growth_duration_days': 40,
            'harvest_duration_days': 12,
            'seed_rate_direct_value': 3,
            'seed_rate_direct_unit': SEED_RATE_UNIT_G_PER_M2,
            'supplier': suppliers['complete'],
            'selected_seed_demand_supplier': suppliers['complete'],
            'display_color': '#6d28d9',
        },
        'missing_spacing': {
            **base_kwargs,
            'name': 'Kultur – Pflanzabstände fehlen',
            'variety': 'Dichte offen',
            'row_spacing_m': None,
            'distance_within_row_m': None,
            'seed_rate_direct_value': 3,
            'seed_rate_direct_unit': SEED_RATE_UNIT_G_PER_M2,
            'supplier': suppliers['complete'],
            'selected_seed_demand_supplier': suppliers['complete'],
            'display_color': '#be123c',
        },
        'missing_yield': {
            **base_kwargs,
            'name': 'Ertrag – erwarteter Ertrag fehlt',
            'variety': 'Ertragsübersicht',
            'expected_yield': None,
            'harvest_method': '',
            'seed_rate_direct_value': 3,
            'seed_rate_direct_unit': SEED_RATE_UNIT_G_PER_M2,
            'supplier': suppliers['empty_order'],
            'selected_seed_demand_supplier': suppliers['empty_order'],
            'display_color': '#525252',
        },
        'imported_modified': {
            **base_kwargs,
            'name': 'Bibliothek – importiert und geändert',
            'variety': 'Version 1',
            'origin_type': Culture.ORIGIN_IMPORTED,
            'is_modified_from_source': True,
            'source_public_version': 1,
            'seed_rate_direct_value': 3,
            'seed_rate_direct_unit': SEED_RATE_UNIT_G_PER_M2,
            'supplier': suppliers['complete'],
            'selected_seed_demand_supplier': suppliers['complete'],
            'display_color': '#2563eb',
        },
    }
    return {
        key: Culture.objects.create(project=project, **spec)
        for key, spec in culture_specs.items()
    }


def _create_supplier_data(
    project: Project,
    cultures: dict[str, Culture],
    suppliers: dict[str, Supplier],
) -> None:
    standard_packages = [
        {'size_value': 10, 'size_unit': SEED_PACKAGE_UNIT_GRAMS},
        {'size_value': 25, 'size_unit': SEED_PACKAGE_UNIT_GRAMS},
    ]
    seed_packages = [
        {'size_value': 1000, 'size_unit': SEED_PACKAGE_UNIT_SEEDS},
        {'size_value': 5000, 'size_unit': SEED_PACKAGE_UNIT_SEEDS},
    ]
    for key in (
        'complete',
        'missing_seed_rate',
        'missing_area',
        'missing_row_spacing',
        'missing_quantity',
        'no_timing',
        'partial_timing',
        'complete_timing',
        'missing_spacing',
        'imported_modified',
    ):
        CultureSupplierData.objects.create(
            project=project,
            culture=cultures[key],
            supplier=suppliers['complete'],
            supplier_product_name=cultures[key].name,
            supplier_product_url='https://hint-complete.example/product',
            packaging_sizes=standard_packages,
            germination_rate=90,
        )

    CultureSupplierData.objects.create(
        project=project,
        culture=cultures['missing_tkg'],
        supplier=suppliers['complete'],
        supplier_product_name=cultures['missing_tkg'].name,
        supplier_product_url='https://hint-complete.example/tkg-fehlt',
        packaging_sizes=standard_packages,
    )
    CultureSupplierData.objects.create(
        project=project,
        culture=cultures['choose_supplier'],
        supplier=suppliers['complete'],
        supplier_product_name='Option A',
        supplier_product_url='https://hint-complete.example/option-a',
        packaging_sizes=standard_packages,
    )
    CultureSupplierData.objects.create(
        project=project,
        culture=cultures['choose_supplier'],
        supplier=suppliers['secondary'],
        supplier_product_name='Option B',
        supplier_product_url='https://hint-tkg.example/option-b',
        packaging_sizes=[{'size_value': 50, 'size_unit': SEED_PACKAGE_UNIT_GRAMS}],
    )
    CultureSupplierData.objects.create(
        project=project,
        culture=cultures['supplier_tkg_override'],
        supplier=suppliers['secondary'],
        supplier_product_name=cultures['supplier_tkg_override'].name,
        supplier_product_url='https://hint-tkg.example/override',
        packaging_sizes=standard_packages,
        thousand_kernel_weight_g=Decimal('2.00'),
    )
    CultureSupplierData.objects.create(
        project=project,
        culture=cultures['germination_rate'],
        supplier=suppliers['complete'],
        supplier_product_name=cultures['germination_rate'].name,
        supplier_product_url='https://hint-complete.example/germination',
        packaging_sizes=standard_packages,
        germination_rate=50,
    )
    CultureSupplierData.objects.create(
        project=project,
        culture=cultures['missing_yield'],
        supplier=suppliers['empty_order'],
        supplier_product_name='Absichtlich ohne Verpackungsgrößen',
        supplier_product_url='https://hint-no-order.example/missing-yield',
        packaging_sizes=[],
    )
    CultureSupplierData.objects.create(
        project=project,
        culture=cultures['supplier_tkg_override'],
        supplier=suppliers['complete'],
        supplier_product_name='Seed package option',
        supplier_product_url='https://hint-complete.example/seeds',
        packaging_sizes=seed_packages,
        thousand_kernel_weight_g=Decimal('10.00'),
    )


def _create_planting_plans(
    project: Project,
    cultures: dict[str, Culture],
    beds: dict[str, Bed],
    owner: Any | None,
) -> None:
    plan_specs = [
        ('complete', 'complete', date(2026, 3, 1), Decimal('5.0'), 120, 'direct_sowing'),
        ('missing_seed_rate', 'complete', date(2026, 3, 5), Decimal('4.0'), 80, 'direct_sowing'),
        ('missing_area', 'missing_area', date(2026, 3, 10), None, 80, 'direct_sowing'),
        ('missing_row_spacing', 'complete', date(2026, 3, 15), Decimal('4.0'), 80, 'direct_sowing'),
        (
            'missing_quantity',
            'complete',
            date(2026, 3, 20),
            Decimal('2.0'),
            None,
            'pre_cultivation',
        ),
        ('missing_tkg', 'complete', date(2026, 3, 25), Decimal('2.0'), 80, 'direct_sowing'),
        ('missing_supplier', 'complete', date(2026, 3, 30), Decimal('3.0'), 60, 'direct_sowing'),
        ('choose_supplier', 'complete', date(2026, 4, 4), Decimal('3.0'), 60, 'direct_sowing'),
        (
            'supplier_tkg_override',
            'complete',
            date(2026, 4, 9),
            Decimal('2.0'),
            60,
            'direct_sowing',
        ),
        ('germination_rate', 'complete', date(2026, 4, 14), Decimal('3.0'), 60, 'direct_sowing'),
        ('no_timing', 'complete', date(2026, 4, 19), Decimal('2.0'), 50, 'direct_sowing'),
        ('partial_timing', 'complete', date(2026, 4, 24), Decimal('2.0'), 50, 'direct_sowing'),
        ('complete_timing', 'complete', date(2026, 4, 29), Decimal('2.0'), 50, 'direct_sowing'),
        ('missing_spacing', 'complete', date(2026, 5, 4), Decimal('2.0'), 50, 'direct_sowing'),
        ('missing_yield', 'complete', date(2026, 5, 9), Decimal('2.0'), 50, 'direct_sowing'),
        ('imported_modified', 'complete', date(2026, 5, 14), Decimal('2.0'), 50, 'direct_sowing'),
        ('complete_timing', 'conflict', date(2026, 6, 1), Decimal('0.8'), 40, 'direct_sowing'),
        ('germination_rate', 'conflict', date(2026, 6, 8), Decimal('0.8'), 40, 'direct_sowing'),
    ]
    for culture_key, bed_key, planting_date, area, quantity, cultivation_type in plan_specs:
        PlantingPlan.objects.create(
            project=project,
            culture=cultures[culture_key],
            bed=beds[bed_key],
            cultivation_type=cultivation_type,
            planting_date=planting_date,
            area_usage_sqm=area,
            quantity=quantity,
            notes=f'Testfall für {cultures[culture_key].name}',
            created_by=owner,
            updated_by=owner,
        )

    PlantingPlan.objects.create(
        project=project,
        culture=None,
        bed=beds['complete'],
        cultivation_type='',
        planting_date=None,
        notes='Entwurf – Kultur und Datum fehlen',
        created_by=owner,
        updated_by=owner,
    )


def _create_invitation(project: Project, owner: Any | None) -> None:
    ProjectInvitation.objects.create(
        project=project,
        email=HINT_TEST_INVITATION_EMAIL,
        role=ProjectMembership.ROLE_MEMBER,
        token=f'hint-test-project-invitation-token-{project.id}',
        status=ProjectInvitation.STATUS_PENDING,
        invited_by=owner,
        expires_at=timezone.now() + timedelta(days=14),
        message='Einladung für Berechtigungs- und Hinweisprüfungen.',
    )
