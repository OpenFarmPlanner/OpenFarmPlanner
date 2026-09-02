from datetime import date

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from crops.models import CropSpecies, CropSpeciesTranslation
from farm.models import Location, Field, Bed, Crop, CropSupplierData, PlantingPlan, Project, ProjectMembership, Supplier

User = get_user_model()


@pytest.fixture
def project_context(db):
    user = User.objects.create_user(username='sduser', email='sd@example.com', password='testpass', is_active=True)
    project = Project.objects.create(name='Seed Demand Project', slug='seed-demand-project')
    ProjectMembership.objects.create(user=user, project=project, role='admin')
    return user, project


@pytest.fixture
def api_client(project_context):
    user, project = project_context
    client = APIClient()
    client.force_authenticate(user=user)
    client.defaults['HTTP_X_PROJECT_ID'] = str(project.id)
    return client


@pytest.fixture
def bed(project_context):
    _, project = project_context
    location = Location.objects.create(name='Loc', project=project)
    field = Field.objects.create(name='Field', location=location, project=project)
    return Bed.objects.create(name='Bed', field=field, area_sqm=100, project=project)


def _create_plan(crop: Crop, bed: Bed, area: float, quantity: int | None = None, cultivation_type: str = 'direct_sowing'):
    return PlantingPlan.objects.create(
        crop=crop,
        bed=bed,
        planting_date=date(2025, 3, 1),
        area_usage_sqm=area,
        quantity=quantity,
        cultivation_type=cultivation_type,
        project=bed.project,
    )


def _create_supplier_data(
    crop: Crop,
    package_size: float,
    package_unit: str,
    thousand_kernel_weight_g: float | None = None,
    germination_rate: float | None = None,
) -> None:
    supplier = Supplier.objects.create(
        name=f'Supplier {crop.name}',
        homepage_url=f'https://{crop.name.lower()}.example',
        project=crop.project,
    )
    CropSupplierData.objects.create(
        crop=crop,
        supplier=supplier,
        project=crop.project,
        packaging_sizes=[{'size_value': package_size, 'size_unit': package_unit}],
        thousand_kernel_weight_g=thousand_kernel_weight_g,
        germination_rate=germination_rate,
    )


@pytest.mark.django_db
def test_seed_demand_applies_safety_margin(api_client: APIClient, bed: Bed):
    crop = Crop.objects.create(
        name='Carrot',
        growth_duration_days=90,
        harvest_duration_days=14,
        cultivation_types=['direct_sowing'],
        seed_rate_direct_value=10,
        seed_rate_direct_unit='g_per_m2',
        sowing_calculation_safety_percent_direct=10,
        project=bed.project,
    )
    _create_plan(crop, bed, 5)
    _create_plan(crop, bed, 5)
    _create_supplier_data(crop, 25, 'g')

    response = api_client.get('/openfarmplanner/api/seed-demand/')
    row = response.json()['results'][0]
    assert response.status_code == 200
    assert row['required_amount_value'] == pytest.approx(110.0)
    assert row['calculation_blockers'] == []
    assert row['package_blocker'] is None
    assert row['required_amount_unit'] == 'g'
    assert row['package_suggestion']['pack_count'] == 5


@pytest.mark.django_db
def test_seed_demand_localizes_linked_crop_species_name(api_client: APIClient, bed: Bed):
    species = CropSpecies.objects.create(name='Seed Demand Localized Species')
    CropSpeciesTranslation.objects.create(species=species, language_code='de', common_name='Ackerbohne')
    CropSpeciesTranslation.objects.create(species=species, language_code='en', common_name='Broad bean')
    crop = Crop.objects.create(
        name='Ackerbohne',
        variety='Hangdown',
        crop_species=species,
        growth_duration_days=90,
        harvest_duration_days=14,
        cultivation_types=['direct_sowing'],
        seed_rate_direct_value=10,
        seed_rate_direct_unit='g_per_m2',
        project=bed.project,
    )
    _create_plan(crop, bed, 5)
    _create_supplier_data(crop, 25, 'g')

    response = api_client.get('/openfarmplanner/api/seed-demand/', HTTP_ACCEPT_LANGUAGE='en')

    row = response.json()['results'][0]
    assert response.status_code == 200
    assert row['crop_id'] == crop.id
    assert row['crop_name'] == 'Ackerbohne'
    assert row['crop_display_name'] == 'Broad bean'
    assert row['crop_display_language_code'] == 'en'
    assert row['variety'] == 'Hangdown'


@pytest.mark.django_db
def test_seed_demand_applies_germination_rate(api_client: APIClient, bed: Bed):
    crop = Crop.objects.create(
        name='Radish',
        growth_duration_days=30,
        harvest_duration_days=14,
        cultivation_types=['direct_sowing'],
        seed_rate_direct_value=10,
        seed_rate_direct_unit='g_per_m2',
        project=bed.project,
    )
    _create_plan(crop, bed, 10)
    _create_supplier_data(crop, 25, 'g', germination_rate=80)

    response = api_client.get('/openfarmplanner/api/seed-demand/')
    row = response.json()['results'][0]
    assert response.status_code == 200
    # 10 m² * 10 g/m² = 100g raw, inflated by 100/80 germination rate = 125g.
    assert row['required_amount_value'] == pytest.approx(125.0)
    assert row['required_amount_unit'] == 'g'
    assert row['package_suggestion']['pack_count'] == 5


@pytest.mark.django_db
def test_seed_demand_ignores_missing_germination_rate(api_client: APIClient, bed: Bed):
    crop = Crop.objects.create(
        name='Lettuce',
        growth_duration_days=45,
        harvest_duration_days=14,
        cultivation_types=['direct_sowing'],
        seed_rate_direct_value=10,
        seed_rate_direct_unit='g_per_m2',
        project=bed.project,
    )
    _create_plan(crop, bed, 10)
    _create_supplier_data(crop, 25, 'g')

    response = api_client.get('/openfarmplanner/api/seed-demand/')
    row = response.json()['results'][0]
    assert response.status_code == 200
    assert row['required_amount_value'] == pytest.approx(100.0)


@pytest.mark.django_db
def test_seed_demand_supports_seed_per_m2_and_seed_packages(api_client: APIClient, bed: Bed):
    crop = Crop.objects.create(
        name='Beetroot',
        growth_duration_days=90,
        harvest_duration_days=14,
        cultivation_types=['direct_sowing'],
        seed_rate_direct_value=9,
        seed_rate_direct_unit='seeds_per_m2',
        project=bed.project,
    )
    _create_plan(crop, bed, 10)
    _create_supplier_data(crop, 50, 'seeds')

    response = api_client.get('/openfarmplanner/api/seed-demand/')
    assert response.status_code == 200

    row = next(item for item in response.json()['results'] if item['crop_name'] == 'Beetroot')
    assert row['required_amount_value'] is None
    assert row['required_amount_unit'] == 'g'
    assert row['required_amount_warning'] == 'missing_tkg'
    assert row['package_suggestion']['pack_count'] == 2


@pytest.mark.django_db
def test_seed_demand_converts_grams_to_seed_packages_with_tkg(api_client: APIClient, bed: Bed):
    crop = Crop.objects.create(
        name='Spinach',
        growth_duration_days=55,
        harvest_duration_days=14,
        cultivation_types=['direct_sowing'],
        seed_rate_direct_value=20,
        seed_rate_direct_unit='g_per_m2',
        thousand_kernel_weight_g=10,
        project=bed.project,
    )
    _create_plan(crop, bed, 5)
    _create_supplier_data(crop, 5000, 'seeds', thousand_kernel_weight_g=2)

    response = api_client.get('/openfarmplanner/api/seed-demand/')
    assert response.status_code == 200

    row = next(item for item in response.json()['results'] if item['crop_name'] == 'Spinach')
    assert row['required_amount_unit'] == 'g'
    assert row['required_amount_value'] == pytest.approx(100.0)
    assert row['package_suggestion']['pack_count'] == 10


@pytest.mark.django_db
def test_seed_demand_returns_warning_when_conversion_missing(api_client: APIClient, bed: Bed):
    crop = Crop.objects.create(
        name='Radish',
        growth_duration_days=35,
        harvest_duration_days=10,
        cultivation_types=['pre_cultivation'],
        seed_rate_pre_cultivation_value=2,
        seed_rate_pre_cultivation_unit='seeds_per_plant',
        project=bed.project,
    )
    _create_plan(crop, bed, 10, quantity=30, cultivation_type='pre_cultivation')
    _create_supplier_data(crop, 5, 'g')

    response = api_client.get('/openfarmplanner/api/seed-demand/')
    assert response.status_code == 200

    row = next(item for item in response.json()['results'] if item['crop_name'] == 'Radish')
    assert row['required_amount_value'] is None
    assert row['required_amount_unit'] == 'g'
    assert row['required_amount_warning'] == 'missing_tkg'
    assert row['package_suggestion'] is None
    assert row['warning'] == 'missing_tkg'


@pytest.mark.django_db
def test_seed_demand_uses_method_specific_seed_rates_for_mixed_cultivation(api_client: APIClient, bed: Bed):
    crop = Crop.objects.create(
        name='Mixed',
        growth_duration_days=80,
        harvest_duration_days=20,
        cultivation_types=['pre_cultivation', 'direct_sowing'],
        seed_rate_direct_value=4,
        seed_rate_direct_unit='g_per_m2',
        sowing_calculation_safety_percent_direct=0,
        seed_rate_pre_cultivation_value=2,
        seed_rate_pre_cultivation_unit='g_per_m2',
        sowing_calculation_safety_percent_pre_cultivation=50,
        project=bed.project,
    )
    _create_plan(crop, bed, 10, cultivation_type='direct_sowing')
    _create_plan(crop, bed, 10, cultivation_type='pre_cultivation')
    response = api_client.get('/openfarmplanner/api/seed-demand/')
    assert response.status_code == 200
    row = next(item for item in response.json()['results'] if item['crop_name'] == 'Mixed')
    # direct: 40g; transplant with 50% margin: 30g => total 70g
    assert row['required_amount_value'] == pytest.approx(70.0)


@pytest.mark.django_db
def test_seed_demand_ignores_inactive_method_rates(api_client: APIClient, bed: Bed):
    crop = Crop.objects.create(
        name='InactiveDirect',
        growth_duration_days=80,
        harvest_duration_days=20,
        cultivation_types=['pre_cultivation'],
        seed_rate_direct_value=3,
        seed_rate_direct_unit='g_per_m2',
        seed_rate_pre_cultivation_value=2,
        seed_rate_pre_cultivation_unit='g_per_m2',
        project=bed.project,
    )
    _create_plan(crop, bed, 10, cultivation_type='direct_sowing')
    response = api_client.get('/openfarmplanner/api/seed-demand/')
    assert response.status_code == 200
    row = next(item for item in response.json()['results'] if item['crop_name'] == 'InactiveDirect')
    assert row['warning'] == 'Missing seed rate value or unit.'


@pytest.mark.django_db
def test_seed_demand_reports_all_missing_inputs_for_one_plan(api_client: APIClient, bed: Bed):
    crop = Crop.objects.create(
        name='Incomplete lfm crop',
        cultivation_types=['direct_sowing'],
        seed_rate_direct_value=3,
        seed_rate_direct_unit='g_per_lfm',
        row_spacing_m=None,
        project=bed.project,
    )
    _create_plan(crop, bed, 0)
    _create_supplier_data(crop, 25, 'g')

    response = api_client.get('/openfarmplanner/api/seed-demand/')
    assert response.status_code == 200
    row = response.json()['results'][0]

    assert row['required_amount_value'] is None
    assert row['calculation_blockers'] == ['missing_area', 'missing_row_spacing']
    assert row['package_suggestion'] is None
    assert row['package_blocker'] == 'required_amount_unavailable'


@pytest.mark.django_db
def test_seed_demand_single_supplier_selection_does_not_write_on_get(api_client: APIClient, bed: Bed):
    crop = Crop.objects.create(
        name='NoWriteSelection',
        growth_duration_days=60,
        harvest_duration_days=10,
        cultivation_types=['direct_sowing'],
        seed_rate_direct_value=5,
        seed_rate_direct_unit='g_per_m2',
        project=bed.project,
    )
    _create_plan(crop, bed, 10)
    supplier = Supplier.objects.create(
        name='Single Supplier',
        homepage_url='https://single.example',
        project=bed.project,
    )
    CropSupplierData.objects.create(
        crop=crop,
        supplier=supplier,
        project=bed.project,
        packaging_sizes=[{'size_value': 25, 'size_unit': 'g'}],
    )

    response = api_client.get('/openfarmplanner/api/seed-demand/')
    assert response.status_code == 200

    row = next(item for item in response.json()['results'] if item['crop_name'] == 'NoWriteSelection')
    assert row['selected_supplier_id'] == supplier.id

    crop.refresh_from_db()
    assert crop.selected_seed_demand_supplier_id is None


@pytest.mark.django_db
def test_seed_rate_unit_legacy_value_is_normalized(api_client: APIClient, project_context):
    payload = {
        'name': 'Bean',
        'variety': 'Runner',
        'growth_duration_days': 70,
        'harvest_duration_days': 10,
        'harvest_method': 'per_plant',
        'seed_rate_value': 2,
        'seed_rate_unit': 'pcs_per_plant',
        'supplier_name': 'Test Supplier',
        'project': project_context[1].id,
    }

    response = api_client.post('/openfarmplanner/api/crops/', payload, format='json')
    assert response.status_code == 201
    assert response.json()['seed_rate_unit'] == 'seeds_per_plant'
