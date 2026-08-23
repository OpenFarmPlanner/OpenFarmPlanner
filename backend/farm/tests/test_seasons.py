"""Tests for the seasons domain: label computation, pattern math, CRUD, copy-data, and setup."""

from datetime import date

from farm.models import PlantingPlan, Season, SeasonPattern
from farm.services.seasons import (
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
