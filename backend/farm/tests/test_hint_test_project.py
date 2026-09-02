from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase

from accounts.consent import CURRENT_VERSIONS, REQUIRED_DOCUMENTS, get_pending_consent_documents
from accounts.models import UserProjectSettings
from farm.models import (
    Bed,
    Crop,
    CropSupplierData,
    Location,
    PlantingPlan,
    Project,
    ProjectInvitation,
    ProjectMembership,
    Supplier,
)
from farm.services.demo_project import DEMO_PROJECT_SLUG, create_or_reset_demo_project
from farm.services.hint_test_project import (
    HINT_TEST_INVITATION_EMAIL,
    HINT_TEST_PROJECT_NAME,
    HINT_TEST_PROJECT_SLUG,
    create_or_reset_hint_test_project,
)
from farm.services.seed_demand import REQUIRED_AMOUNT_WARNING_MISSING_TKG, build_seed_demand_rows

User = get_user_model()


class HintTestProjectServiceTests(TestCase):
    def test_create_or_reset_hint_test_project_creates_expected_access_and_data(self) -> None:
        result = create_or_reset_hint_test_project()

        self.assertEqual(result.project.slug, HINT_TEST_PROJECT_SLUG)
        self.assertEqual(result.project.name, HINT_TEST_PROJECT_NAME)
        self.assertTrue(
            ProjectMembership.objects.filter(
                user=result.user,
                project=result.project,
                role=ProjectMembership.ROLE_ADMIN,
            ).exists()
        )
        self.assertTrue(
            ProjectMembership.objects.filter(
                user=result.member_user,
                project=result.project,
                role=ProjectMembership.ROLE_MEMBER,
            ).exists()
        )
        self.assertEqual(
            UserProjectSettings.objects.get(user=result.user).last_project_id,
            result.project.id,
        )
        self.assertEqual(
            UserProjectSettings.objects.get(user=result.member_user).last_project_id,
            result.project.id,
        )
        self.assertEqual(get_pending_consent_documents(result.user), [])
        self.assertEqual(get_pending_consent_documents(result.member_user), [])
        self.assertEqual(Location.objects.filter(project=result.project).count(), 2)
        self.assertEqual(Bed.objects.filter(project=result.project).count(), 3)
        self.assertEqual(Crop.objects.filter(project=result.project).count(), 16)
        self.assertEqual(PlantingPlan.objects.filter(project=result.project).count(), 19)
        self.assertEqual(Supplier.objects.filter(project=result.project).count(), 3)
        self.assertEqual(CropSupplierData.objects.filter(project=result.project).count(), 17)
        self.assertTrue(
            ProjectInvitation.objects.filter(
                project=result.project,
                email_normalized=HINT_TEST_INVITATION_EMAIL,
                status=ProjectInvitation.STATUS_PENDING,
            ).exists()
        )

    def test_create_or_reset_hint_test_project_is_idempotent(self) -> None:
        first = create_or_reset_hint_test_project()
        Location.objects.create(name='Temporary hint row', project=first.project)

        second = create_or_reset_hint_test_project()

        self.assertEqual(second.project.id, first.project.id)
        self.assertFalse(second.created_project)
        self.assertFalse(
            Location.objects.filter(project=first.project, name='Temporary hint row').exists()
        )
        self.assertEqual(Location.objects.filter(project=first.project).count(), 2)
        self.assertEqual(Crop.objects.filter(project=first.project).count(), 16)
        self.assertEqual(PlantingPlan.objects.filter(project=first.project).count(), 19)
        for document in REQUIRED_DOCUMENTS:
            self.assertEqual(
                first.user.document_consents.filter(
                    document=document,
                    version=CURRENT_VERSIONS[document],
                ).count(),
                1,
            )
        self.assertEqual(
            ProjectInvitation.objects.filter(
                project=first.project,
                email_normalized=HINT_TEST_INVITATION_EMAIL,
            ).count(),
            1,
        )

    def test_hint_test_project_seed_demand_rows_cover_warning_states(self) -> None:
        result = create_or_reset_hint_test_project()

        rows = {
            row['crop_name']: row
            for row in build_seed_demand_rows(
                project=result.project,
                selected_supplier_by_crop={},
                language_code='de',
            )
        }

        self.assertIsNone(rows['Saatgutmenge – vollständig berechenbar']['warning'])
        self.assertGreater(rows['Saatgutmenge – vollständig berechenbar']['packages_needed'], 0)
        self.assertEqual(
            rows['Saatgutmenge – Aussaatmenge fehlt']['warning'],
            'Missing seed rate value or unit.',
        )
        self.assertEqual(
            rows['Saatgutmenge – Aussaatmenge fehlt']['calculation_blockers'],
            ['missing_seed_rate'],
        )
        self.assertEqual(
            rows['Saatgutmenge – Beetfläche fehlt']['warning'],
            'Missing area usage for m²-based seed requirement.',
        )
        self.assertEqual(
            rows['Saatgutmenge – Reihenabstand fehlt']['warning'],
            'Missing row spacing for lfm-based seed requirement.',
        )
        self.assertEqual(
            rows['Saatgutmenge – Pflanzenanzahl fehlt']['warning'],
            'Missing plant quantity for seeds-per-plant requirement.',
        )
        self.assertEqual(
            rows['Saatgutmenge – TKG fehlt']['required_amount_warning'],
            REQUIRED_AMOUNT_WARNING_MISSING_TKG,
        )
        self.assertEqual(
            rows['Saatgutmenge – Lieferant fehlt']['warning'],
            'Keine Lieferantendaten vorhanden.',
        )
        self.assertEqual(
            rows['Saatgutmenge – Lieferant fehlt']['package_blocker'],
            'supplier_data_missing',
        )
        self.assertEqual(len(rows['Saatgutmenge – Lieferant auswählen']['supplier_options']), 2)
        self.assertIsNone(rows['Saatgutmenge – Lieferant auswählen']['selected_supplier_id'])
        self.assertEqual(
            rows['Saatgutmenge – Lieferanten-TKG überschreibt Kultur']['required_amount_value'],
            4.0,
        )
        self.assertEqual(
            rows['Saatgutmenge – Keimrate erhöht Bedarf']['required_amount_value'],
            45.6,
        )

    def test_hint_test_project_covers_complete_missing_and_partial_durations(self) -> None:
        result = create_or_reset_hint_test_project()

        no_timing = PlantingPlan.objects.get(
            project=result.project,
            crop__name='Kultur – keine Zeitangaben',
        )
        partial_timing = PlantingPlan.objects.get(
            project=result.project,
            crop__name='Kultur – nur Wachstumszeit',
        )
        complete_timing = PlantingPlan.objects.filter(
            project=result.project,
            crop__name='Kultur – vollständige Zeitangaben',
        ).order_by('planting_date').first()

        self.assertIsNone(no_timing.harvest_date)
        self.assertIsNone(no_timing.harvest_end_date)
        self.assertIsNotNone(partial_timing.harvest_date)
        self.assertIsNone(partial_timing.harvest_end_date)
        self.assertIsNotNone(complete_timing)
        self.assertIsNotNone(complete_timing.harvest_date)
        self.assertIsNotNone(complete_timing.harvest_end_date)

    def test_hint_test_project_spacing_and_import_states_are_seeded(self) -> None:
        result = create_or_reset_hint_test_project()

        missing_spacing = Crop.objects.get(
            project=result.project,
            name='Kultur – Pflanzabstände fehlen',
        )
        imported_modified = Crop.objects.get(
            project=result.project,
            name='Bibliothek – importiert und geändert',
        )

        self.assertIsNone(missing_spacing.plants_per_m2)
        self.assertEqual(imported_modified.origin_type, Crop.ORIGIN_IMPORTED)
        self.assertTrue(imported_modified.is_modified_from_source)
        self.assertEqual(imported_modified.source_public_version, 1)

    def test_hint_test_project_does_not_reset_existing_demo_project(self) -> None:
        demo = create_or_reset_demo_project()
        demo_crop_count = Crop.objects.filter(project=demo.project).count()

        create_or_reset_hint_test_project()

        demo.project.refresh_from_db()
        self.assertEqual(demo.project.slug, DEMO_PROJECT_SLUG)
        self.assertEqual(Crop.objects.filter(project=demo.project).count(), demo_crop_count)

    def test_management_command_creates_requested_hint_test_project(self) -> None:
        call_command(
            'create_hint_test_project',
            project_slug='command-hint-test',
            user_email='command-hint@example.local',
            username='command-hint-user',
            password='CommandHintPass123!',
            member_email='command-hint-member@example.local',
            member_username='command-hint-member',
            member_password='CommandHintMemberPass123!',
        )

        project = Project.objects.get(slug='command-hint-test')
        user = User.objects.get(email='command-hint@example.local')
        member = User.objects.get(email='command-hint-member@example.local')
        self.assertEqual(project.name, HINT_TEST_PROJECT_NAME)
        self.assertTrue(
            ProjectMembership.objects.filter(project=project, user=user, role='admin').exists()
        )
        self.assertTrue(
            ProjectMembership.objects.filter(project=project, user=member, role='member').exists()
        )
        self.assertEqual(PlantingPlan.objects.filter(project=project).count(), 19)
