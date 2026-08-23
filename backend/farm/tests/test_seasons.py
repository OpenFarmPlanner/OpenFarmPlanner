"""Tests for the seasons domain: label computation, pattern math, CRUD, copy-data, and setup."""

from datetime import date

from farm.models import PlantingPlan, Season, SeasonPattern
from farm.services.demo_project import populate_demo_project
from farm.services.hint_test_project import populate_hint_test_project
from farm.services.seasons import (
    assign_unassigned_planting_plans,
    compute_due_season_period,
    compute_period_containing,
    compute_preview_periods,
    compute_season_period,
    copy_planting_plans,
    find_due_but_missing_season,
)
from farm.tests.api_base import ProjectApiTestCase


class SeasonLabelTest(ProjectApiTestCase):
    def test_calendar_year_label(self):
        season = Season.objects.create(
            project=self.project, start_date=date(2026, 1, 1), end_date=date(2026, 12, 31),
        )
        self.assertEqual(season.label, '2026')

    def test_split_year_label(self):
        season = Season.objects.create(
            project=self.project, start_date=date(2025, 9, 1), end_date=date(2026, 8, 31),
        )
        self.assertEqual(season.label, '25/26')

    def test_custom_label_overrides_computed(self):
        season = Season.objects.create(
            project=self.project, start_date=date(2026, 1, 1), end_date=date(2026, 12, 31),
            custom_label='Vor der Renovierung',
        )
        self.assertEqual(season.label, 'Vor der Renovierung')
        self.assertEqual(season.computed_label, '2026')


class SeasonPatternMathTest(ProjectApiTestCase):
    def test_compute_season_period_clamps_short_month(self):
        pattern = SeasonPattern(project=self.project, start_day=31, start_month=2)
        start_date, end_date = compute_season_period(pattern, 2026)
        self.assertEqual(start_date, date(2026, 2, 28))
        self.assertEqual(end_date, date(2027, 2, 27))

    def test_compute_period_containing_before_and_after_start(self):
        pattern = SeasonPattern(project=self.project, start_day=1, start_month=9)
        before_start = compute_period_containing(pattern, date(2026, 3, 1))
        self.assertEqual(before_start, (date(2025, 9, 1), date(2026, 8, 31)))
        after_start = compute_period_containing(pattern, date(2026, 10, 1))
        self.assertEqual(after_start, (date(2026, 9, 1), date(2027, 8, 31)))

    def test_preview_periods_mark_current(self):
        pattern = SeasonPattern(project=self.project, start_day=1, start_month=1)
        periods = compute_preview_periods(pattern, date(2026, 6, 1))
        self.assertEqual([period['is_current'] for period in periods], [False, True, False])
        self.assertEqual(periods[1]['start_date'], date(2026, 1, 1))
        self.assertEqual(periods[1]['end_date'], date(2026, 12, 31))


class SeasonCopyServiceTest(ProjectApiTestCase):
    def test_copy_is_additive_not_replacing(self):
        source = Season.objects.create(project=self.project, start_date=date(2026, 1, 1), end_date=date(2026, 12, 31))
        target = Season.objects.create(project=self.project, start_date=date(2027, 1, 1), end_date=date(2027, 12, 31))
        PlantingPlan.objects.create(
            culture=self.culture, bed=self.bed, project=self.project, season=source, planting_date=date(2026, 4, 1),
        )
        existing_target_plan = PlantingPlan.objects.create(
            culture=self.culture, bed=self.bed, project=self.project, season=target, planting_date=date(2027, 4, 1),
        )

        copied_count = copy_planting_plans(source_season=source, target_season=target)

        self.assertEqual(copied_count, 1)
        target_plans = PlantingPlan.objects.filter(season=target)
        self.assertEqual(target_plans.count(), 2)
        self.assertTrue(target_plans.filter(pk=existing_target_plan.pk).exists())


class SeasonApiTest(ProjectApiTestCase):
    def test_create_list_and_soft_delete_with_undelete(self):
        create_response = self.client.post('/openfarmplanner/api/seasons/', {
            'start_date': '2026-01-01', 'end_date': '2026-12-31',
        })
        self.assertEqual(create_response.status_code, 201)
        season_id = create_response.data['id']
        self.assertEqual(create_response.data['label'], '2026')

        delete_response = self.client.delete(f'/openfarmplanner/api/seasons/{season_id}/')
        self.assertEqual(delete_response.status_code, 204)
        self.assertFalse(Season.objects.filter(pk=season_id).exists())
        self.assertTrue(Season.all_objects.filter(pk=season_id).exists())

        undelete_response = self.client.post(f'/openfarmplanner/api/seasons/{season_id}/undelete/')
        self.assertEqual(undelete_response.status_code, 200)
        self.assertTrue(Season.objects.filter(pk=season_id).exists())

    def test_copy_from_endpoint_is_additive(self):
        source = Season.objects.create(project=self.project, start_date=date(2026, 1, 1), end_date=date(2026, 12, 31))
        target = Season.objects.create(project=self.project, start_date=date(2027, 1, 1), end_date=date(2027, 12, 31))
        PlantingPlan.objects.create(
            culture=self.culture, bed=self.bed, project=self.project, season=source, planting_date=date(2026, 4, 1),
        )

        response = self.client.post(f'/openfarmplanner/api/seasons/{target.pk}/copy-from/', {
            'source_season_id': source.pk,
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['copied_count'], 1)
        self.assertEqual(response.data['target_planting_plan_count'], 1)

    def test_planting_plans_can_be_filtered_by_season_header(self):
        season_a = Season.objects.create(project=self.project, start_date=date(2026, 1, 1), end_date=date(2026, 12, 31))
        season_b = Season.objects.create(project=self.project, start_date=date(2027, 1, 1), end_date=date(2027, 12, 31))
        plan_a = PlantingPlan.objects.create(
            culture=self.culture, bed=self.bed, project=self.project, season=season_a, planting_date=date(2026, 4, 1),
        )
        PlantingPlan.objects.create(
            culture=self.culture, bed=self.bed, project=self.project, season=season_b, planting_date=date(2027, 4, 1),
        )

        response = self.client.get('/openfarmplanner/api/planting-plans/', HTTP_X_SEASON_ID=str(season_a.pk))
        self.assertEqual(response.status_code, 200)
        ids = [row['id'] for row in response.data['results']]
        self.assertEqual(ids, [plan_a.pk])


class SeasonSetupApiTest(ProjectApiTestCase):
    def test_status_reports_unassigned_plans(self):
        PlantingPlan.objects.create(
            culture=self.culture, bed=self.bed, project=self.project, planting_date=date(2026, 4, 1),
        )
        response = self.client.get('/openfarmplanner/api/season-setup/status/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['needs_setup'])
        self.assertEqual(response.data['unassigned_planting_plan_count'], 1)

    def test_apply_assigns_existing_plans_without_touching_data(self):
        plan = PlantingPlan.objects.create(
            culture=self.culture, bed=self.bed, project=self.project, planting_date=date(2026, 4, 1), notes='keep me',
        )
        response = self.client.post('/openfarmplanner/api/season-setup/apply/', {
            'start_day': 1, 'start_month': 1,
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['assigned_planting_plan_count'], 1)
        plan.refresh_from_db()
        self.assertIsNotNone(plan.season_id)
        self.assertEqual(plan.notes, 'keep me')

        pattern = SeasonPattern.objects.get(project=self.project)
        self.assertEqual((pattern.start_day, pattern.start_month), (1, 1))

    def test_due_suggestion_hidden_once_season_exists(self):
        start_date, end_date = compute_due_season_period(self.project, today=date(2026, 6, 1))
        missing = find_due_but_missing_season(self.project, today=date(2026, 6, 1))
        self.assertEqual(missing, (start_date, end_date))

        Season.objects.create(project=self.project, start_date=start_date, end_date=end_date)
        self.assertIsNone(find_due_but_missing_season(self.project, today=date(2026, 6, 1)))


class SeededProjectSeasonTest(ProjectApiTestCase):
    """The first-run setup modal targets pre-season projects only — a project
    the app itself just seeded must come out already assigned to a season."""

    def _assert_no_setup_needed(self):
        response = self.client.get('/openfarmplanner/api/season-setup/status/')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['needs_setup'])
        self.assertEqual(response.data['unassigned_planting_plan_count'], 0)

    def test_demo_project_plans_are_assigned_to_the_season_of_their_dates(self):
        populate_demo_project(self.project, owner=self.user)

        plans = list(PlantingPlan.objects.filter(project=self.project))
        self.assertGreater(len(plans), 0)
        self.assertEqual({plan.season_id for plan in plans if plan.season_id is None}, set())

        season = Season.objects.get(project=self.project)
        self.assertEqual(season.start_date, date(2026, 1, 1))
        self.assertEqual(season.end_date, date(2026, 12, 31))
        self._assert_no_setup_needed()

    def test_repopulating_the_demo_project_does_not_accumulate_seasons(self):
        populate_demo_project(self.project, owner=self.user)
        populate_demo_project(self.project, owner=self.user)

        self.assertEqual(Season.objects.filter(project=self.project).count(), 1)
        self._assert_no_setup_needed()

    def test_hint_test_project_plans_are_assigned_to_a_season(self):
        populate_hint_test_project(self.project, owner=self.user)

        self.assertFalse(
            PlantingPlan.objects.filter(project=self.project, season__isnull=True).exists(),
        )
        self._assert_no_setup_needed()

    def test_assignment_respects_a_non_calendar_season_pattern(self):
        SeasonPattern.objects.update_or_create(
            project=self.project, defaults={'start_day': 1, 'start_month': 9},
        )
        PlantingPlan.objects.create(
            culture=self.culture, bed=self.bed, project=self.project,
            planting_date=date(2026, 4, 1),
        )

        season = assign_unassigned_planting_plans(self.project)

        self.assertIsNotNone(season)
        self.assertEqual(season.start_date, date(2025, 9, 1))
        self.assertEqual(season.end_date, date(2026, 8, 31))
        self.assertEqual(season.label, '25/26')

    def test_assignment_is_a_no_op_without_planting_plans(self):
        self.assertIsNone(assign_unassigned_planting_plans(self.project))
        self.assertEqual(Season.objects.filter(project=self.project).count(), 0)


class PlantingPlanSeasonFallbackTest(ProjectApiTestCase):
    """A plan created without an active season must not look like legacy data."""

    def _create_plan(self, planting_date='2026-04-01', **headers):
        payload = {
            'culture': self.culture.id,
            'bed': self.bed.id,
            'cultivation_type': 'pre_cultivation',
            'area_usage_sqm': '2.0',
        }
        if planting_date is not None:
            payload['planting_date'] = planting_date
        return self.client.post('/openfarmplanner/api/planting-plans/', payload, **headers)

    def test_create_without_season_header_anchors_the_plan_in_its_own_period(self):
        response = self._create_plan()
        self.assertEqual(response.status_code, 201)

        plan = PlantingPlan.objects.get(pk=response.data['id'])
        self.assertIsNotNone(plan.season_id)
        self.assertEqual(plan.season.start_date, date(2026, 1, 1))
        self.assertEqual(plan.season.end_date, date(2026, 12, 31))

        status_response = self.client.get('/openfarmplanner/api/season-setup/status/')
        self.assertFalse(status_response.data['needs_setup'])

    def test_create_without_planting_date_still_gets_a_season(self):
        response = self._create_plan(planting_date=None)
        self.assertEqual(response.status_code, 201)
        self.assertIsNotNone(PlantingPlan.objects.get(pk=response.data['id']).season_id)

    def test_season_header_still_wins_over_the_fallback(self):
        season = Season.objects.create(
            project=self.project, start_date=date(2024, 1, 1), end_date=date(2024, 12, 31),
        )
        response = self._create_plan(HTTP_X_SEASON_ID=str(season.id))

        self.assertEqual(response.status_code, 201)
        self.assertEqual(PlantingPlan.objects.get(pk=response.data['id']).season_id, season.id)
        self.assertEqual(Season.objects.filter(project=self.project).count(), 1)

    def test_repeated_creates_reuse_the_same_season(self):
        self._create_plan(planting_date='2026-04-01')
        self._create_plan(planting_date='2026-09-15')
        self.assertEqual(Season.objects.filter(project=self.project).count(), 1)

