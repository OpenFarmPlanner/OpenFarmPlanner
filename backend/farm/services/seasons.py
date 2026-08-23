"""Season pattern computation and season-to-season data copy.

A season always spans exactly 12 months from its configured start day/month
(see `SeasonPattern` — duration is deliberately not configurable). All period
math here is hemisphere-agnostic: it only cares about the configured
start day/month, never about calendar-year boundaries.
"""

import calendar
from datetime import date, timedelta

from farm.models import PlantingPlan, Project, Season, SeasonPattern

# Fields copied from a source PlantingPlan onto a new one in the target
# season. Excludes the primary key, timestamps, audit fields, and the
# project/season FKs themselves (set explicitly by the caller).
PLANTING_PLAN_COPY_FIELDS = (
    'culture_id',
    'bed_id',
    'cultivation_type',
    'planting_date',
    'harvest_date',
    'harvest_end_date',
    'quantity',
    'area_usage_sqm',
    'notes',
)


def get_or_create_season_pattern(project: Project) -> SeasonPattern:
    """Return the project's season pattern, creating a Jan 1 default if missing."""
    pattern, _ = SeasonPattern.objects.get_or_create(project=project)
    return pattern


def add_months(reference_date: date, months: int) -> date:
    """Add a number of months to a date, clamping the day to the target month's length."""
    month_index = reference_date.month - 1 + months
    year = reference_date.year + month_index // 12
    month = month_index % 12 + 1
    day = min(reference_date.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def compute_season_period(pattern: SeasonPattern, anchor_year: int) -> tuple[date, date]:
    """Return the (start_date, end_date) of the season pattern period starting in `anchor_year`."""
    day = min(pattern.start_day, calendar.monthrange(anchor_year, pattern.start_month)[1])
    start_date = date(anchor_year, pattern.start_month, day)
    end_date = add_months(start_date, 12) - timedelta(days=1)
    return start_date, end_date


def compute_period_containing(pattern: SeasonPattern, reference_date: date) -> tuple[date, date]:
    """Return the season pattern period that contains `reference_date`."""
    start_date, end_date = compute_season_period(pattern, reference_date.year)
    if reference_date < start_date:
        return compute_season_period(pattern, reference_date.year - 1)
    return start_date, end_date


def compute_preview_periods(pattern: SeasonPattern, today: date) -> list[dict]:
    """Return the previous, current, and next season pattern periods for the settings preview."""
    current_start, current_end = compute_period_containing(pattern, today)
    previous_start, previous_end = compute_season_period(pattern, current_start.year - 1)
    next_start, next_end = compute_season_period(pattern, current_start.year + 1)
    return [
        {'start_date': previous_start, 'end_date': previous_end, 'is_current': False},
        {'start_date': current_start, 'end_date': current_end, 'is_current': True},
        {'start_date': next_start, 'end_date': next_end, 'is_current': False},
    ]


def compute_due_season_period(project: Project, today: date | None = None) -> tuple[date, date]:
    """Return the season pattern period that should be active today for `project`."""
    pattern = get_or_create_season_pattern(project)
    return compute_period_containing(pattern, today or date.today())


def find_due_but_missing_season(project: Project, today: date | None = None) -> tuple[date, date] | None:
    """Return the due season period if it isn't an existing Season yet, else None."""
    due_start, due_end = compute_due_season_period(project, today)
    exists = Season.objects.filter(project=project, start_date=due_start).exists()
    return None if exists else (due_start, due_end)


def copy_planting_plans(*, source_season: Season, target_season: Season) -> int:
    """Copy all planting plans from `source_season` into `target_season`, additively.

    Existing planting plans already in `target_season` are left untouched —
    this only ever appends copies of the source season's plans.
    """
    source_plans = PlantingPlan.objects.filter(season=source_season)
    new_plans = [
        PlantingPlan(
            project=target_season.project,
            season=target_season,
            **{field: getattr(plan, field) for field in PLANTING_PLAN_COPY_FIELDS},
        )
        for plan in source_plans
    ]
    PlantingPlan.objects.bulk_create(new_plans)
    return len(new_plans)
