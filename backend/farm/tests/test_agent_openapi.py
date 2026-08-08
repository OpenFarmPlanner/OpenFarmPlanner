"""Tests for the generated OpenAPI document of the agent API surface."""

from django.contrib.auth import get_user_model
from rest_framework.test import APIClient, APITestCase

from farm.agent_api.openapi import build_openapi_document
from farm.models import Project, ProjectApiToken, ProjectMembership
from farm.services.culture_import.field_specs import (
    CULTURE_FIELD_SPECS_BY_NAME,
    SEED_RATE_UNIT_VALUES,
)

User = get_user_model()


class OpenApiDocumentTests(APITestCase):
    """The document must describe units, bounds, and enums without guesswork."""

    def setUp(self):
        self.document = build_openapi_document()
        self.culture_schema = self.document['components']['schemas']['CultureImportItem']

    def test_document_declares_bearer_security(self):
        scheme = self.document['components']['securitySchemes']['bearerAuth']

        self.assertEqual(scheme['type'], 'http')
        self.assertEqual(scheme['scheme'], 'bearer')
        self.assertEqual(self.document['security'], [{'bearerAuth': []}])

    def test_import_paths_are_documented(self):
        for path in (
            '/culture-imports/preview/',
            '/culture-imports/{draft_id}/',
            '/culture-imports/{draft_id}/apply/',
            '/cultures/',
            '/cultures/{id}/',
        ):
            self.assertIn(path, self.document['paths'])

    def test_delete_is_not_documented_anywhere(self):
        for path_item in self.document['paths'].values():
            self.assertNotIn('delete', path_item)

    def test_only_the_name_field_is_required(self):
        self.assertEqual(self.culture_schema['required'], ['name'])

    def test_length_fields_keep_their_unit_in_the_name(self):
        for field_name in ('row_spacing_m', 'distance_within_row_m', 'sowing_depth_m'):
            schema = self.culture_schema['properties'][field_name]
            self.assertEqual(schema['x-unit'], 'm')
            self.assertIn('metres', schema['description'])

    def test_length_fields_document_their_accepted_input_spellings(self):
        accepted = self.culture_schema['properties']['row_spacing_m']['x-accepted-input-keys']

        self.assertIn('row_spacing_cm', accepted)
        self.assertIn('row_spacing_mm', accepted)

    def test_hard_bounds_are_exposed_as_json_schema_limits(self):
        schema = self.culture_schema['properties']['row_spacing_m']
        spec = CULTURE_FIELD_SPECS_BY_NAME['row_spacing_m']

        self.assertEqual(schema['exclusiveMinimum'], spec.hard_min)
        self.assertEqual(schema['maximum'], spec.hard_max)

    def test_plausible_bounds_are_exposed_separately_from_hard_bounds(self):
        schema = self.culture_schema['properties']['row_spacing_m']

        self.assertEqual(schema['x-plausible-minimum'], 0.05)
        self.assertEqual(schema['x-plausible-maximum'], 1.5)
        self.assertLess(schema['x-plausible-maximum'], schema['maximum'])

    def test_seed_rate_units_list_only_the_canonical_project_vocabulary(self):
        schema = self.culture_schema['properties']['seed_rate_direct_unit']
        self.assertEqual(set(schema['enum']), set(SEED_RATE_UNIT_VALUES))

    def test_coupled_fields_declare_their_companion(self):
        properties = self.culture_schema['properties']

        value_field = properties['seed_rate_direct_value']
        unit_field = properties['seed_rate_direct_unit']
        self.assertEqual(value_field['x-requires'], 'seed_rate_direct_unit')
        self.assertEqual(unit_field['x-requires'], 'seed_rate_direct_value')

    def test_enum_fields_list_their_allowed_values(self):
        properties = self.culture_schema['properties']

        self.assertEqual(set(properties['nutrient_demand']['enum']), {'low', 'medium', 'high'})
        self.assertEqual(
            set(properties['cultivation_types']['items']['enum']),
            {'pre_cultivation', 'direct_sowing'},
        )

    def test_every_field_carries_a_description_and_an_example(self):
        for field_name, schema in self.culture_schema['properties'].items():
            self.assertTrue(schema['description'], f'{field_name} has no description')
            self.assertTrue(schema['examples'], f'{field_name} has no example')

    def test_schema_bounds_match_the_enforced_specs(self):
        # Guards the reason the document is generated rather than hand-written:
        # a bound may not be documented differently from how it is enforced.
        for spec in CULTURE_FIELD_SPECS_BY_NAME.values():
            schema = self.culture_schema['properties'][spec.name]
            if spec.hard_max is not None:
                self.assertEqual(schema['maximum'], spec.hard_max)
            if spec.hard_min is not None and not spec.exclusive_min:
                self.assertEqual(schema['minimum'], spec.hard_min)


class OpenApiEndpointTests(APITestCase):
    """The document is served to token and session clients alike."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='schema-reader', email='schema@example.com', password='pw', is_active=True
        )
        self.project = Project.objects.create(name='Schema Farm', slug='schema-farm')
        ProjectMembership.objects.create(user=self.user, project=self.project, role='member')

    def test_read_token_can_fetch_the_schema(self):
        _, raw_token = ProjectApiToken.create_token(
            user=self.user, project=self.project, name='Reader', scope=ProjectApiToken.SCOPE_READ
        )
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {raw_token}')

        response = client.get('/api/agent/openapi.json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['openapi'], '3.1.0')

    def test_server_url_points_at_the_api_root(self):
        client = APIClient()
        client.force_authenticate(user=self.user)

        response = client.get('/api/agent/openapi.json')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['servers'][0]['url'].endswith('/api'))

    def test_document_contains_no_secret_material(self):
        client = APIClient()
        client.force_authenticate(user=self.user)

        response = client.get('/api/agent/openapi.json')

        self.assertNotIn('ofp_pat_', str(response.data).replace('`ofp_pat_`', ''))
