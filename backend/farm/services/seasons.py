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

# Date fields on a copied PlantingPlan that are shifted forward so the copy
# lands in the target season's own period instead of the source season's.
PLANTING_PLAN_SHIFTED_DATE_FIELDS = ('planting_date', 'harvest_date', 'harvest_end_date')


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


def _pattern_start_for_year(pattern: SeasonPattern, year: int) -> date:
    """Return the pattern's start day/month in `year`, clamped to the month length."""
    day = min(pattern.start_day, calendar.monthrange(year, pattern.start_month)[1])
    return date(year, pattern.start_month, day)


def compute_next_pattern_start_after(pattern: SeasonPattern, reference_date: date) -> date:
    """Return the earliest pattern start date strictly after `reference_date`."""
    candidate = _pattern_start_for_year(pattern, reference_date.year)
    if candidate <= reference_date:
        candidate = _pattern_start_for_year(pattern, reference_date.year + 1)
    return candidate


def compute_custom_season_period(pattern: SeasonPattern, start_date: date) -> tuple[date, date]:
    """Return an individual season period for a hand-picked `start_date`.

    The end date is the day before the next pattern start on/after `start_date`,
    so a transitional season snaps back onto the regular pattern grid rather
    than running a fixed 12 months from an off-grid start.
    """
    return start_date, compute_next_pattern_start_after(pattern, start_date) - timedelta(days=1)


def analyze_period_transition(previous_end: date, next_start: date) -> dict | None:
    """Classify the join between one period's end and the next period's start.

    Returns ``None`` when they are seamless (the next period starts the day
    after the previous one ends), otherwise a dict with ``kind`` (``'gap'`` or
    ``'overlap'``) and the ``start_date``/``end_date`` of the affected range.
    """
    seam = previous_end + timedelta(days=1)
    if next_start == seam:
        return None
    if next_start > seam:
        return {'kind': 'gap', 'start_date': seam, 'end_date': next_start - timedelta(days=1)}
    return {'kind': 'overlap', 'start_date': next_start, 'end_date': previous_end}


def latest_existing_season(project: Project) -> Season | None:
    """Return the project's chronologically latest (not soft-deleted) season."""
    return Season.objects.filter(project=project).order_by('-start_date').first()


def compute_first_future_pattern_period(
    pattern: SeasonPattern, latest_season: Season,
) -> tuple[date, date]:
    """Return the first full pattern period that starts after `latest_season` ends."""
    anchor_year = latest_season.start_date.year + 1
    next_start, next_end = compute_season_period(pattern, anchor_year)
    while next_start <= latest_season.end_date:
        anchor_year += 1
        next_start, next_end = compute_season_period(pattern, anchor_year)
    return next_start, next_end


def compute_due_season_period(project: Project, today: date | None = None) -> tuple[date, date]:
    """Return the season pattern period that should be active today for `project`."""
    pattern = get_or_create_season_pattern(project)
    return compute_period_containing(pattern, today or date.today())


def find_due_but_missing_season(project: Project, today: date | None = None) -> tuple[date, date] | None:
    """Return the next season period that can be created for ``project``.

    Once a project has seasons, the suggestion follows its chronologically
    latest season rather than the period containing today's date. Projects
    without a season retain the initial suggestion for the current period.
    """
    latest_season = latest_existing_season(project)
    if latest_season is None:
        due_start, due_end = compute_due_season_period(project, today)
        return due_start, due_end

    pattern = get_or_create_season_pattern(project)
    next_start, next_end = compute_first_future_pattern_period(pattern, latest_season)

    overlaps_existing = Season.objects.filter(
        project=project,
        start_date__lte=next_end,
        end_date__gte=next_start,
    ).exists()
    return None if overlaps_existing else (next_start, next_end)


def copy_planting_plans(*, source_season: Season, target_season: Season) -> list[PlantingPlan]:
    """Copy all planting plans from `source_season` into `target_season`, additively.

    Planting, harvest and harvest-end dates are shifted forward (or back) by the
    whole-year gap between the two seasons' start dates, so the copies land in
    the target season's own period. Feb 29 is clamped to Feb 28 when the shifted
    year is not a leap year.

    Existing planting plans already in `target_season` are left untouched —
    this only ever appends copies of the source season's plans. Returns the
    created plans so the caller can record revisions for them.
    """
    year_offset = target_season.start_date.year - source_season.start_date.year
    month_offset = year_offset * 12

    def shifted(value: date | None) -> date | None:
        return None if value is None else add_months(value, month_offset)

    source_plans = PlantingPlan.objects.filter(season=source_season)
    new_plans = []
    for plan in source_plans:
        fields = {field: getattr(plan, field) for field in PLANTING_PLAN_COPY_FIELDS}
        for date_field in PLANTING_PLAN_SHIFTED_DATE_FIELDS:
            fields[date_field] = shifted(fields[date_field])
        new_plans.append(PlantingPlan(project=target_season.project, season=target_season, **fields))
    return PlantingPlan.objects.bulk_create(new_plans)


def get_or_create_season_for_period(
    project: Project,
    start_date: date,
    end_date: date,
    *,
    created_by=None,
) -> Season:
    """Return the project's season starting on `start_date`, creating it if missing."""
    season, _ = Season.objects.get_or_create(
        project=project,
        start_date=start_date,
        defaults={'end_date': end_date, 'created_by': created_by},
    )
    return season


def get_or_create_season_for_date(
    project: Project,
    reference_date: date | None = None,
    *,
    created_by=None,
) -> Season:
    """Return the project's season containing `reference_date` (today if None).

    The single entry point for "this plan needs *some* season": it resolves the
    period from the project's own pattern, so a project never ends up with a
    season it did not configure.
    """
    pattern = get_or_create_season_pattern(project)
    start_date, end_date = compute_period_containing(pattern, reference_date or date.today())
    return get_or_create_season_for_period(project, start_date, end_date, created_by=created_by)


def earliest_unassigned_planting_date(project: Project) -> date | None:
    """Return the earliest `planting_date` among `project`'s season-less plans, if any."""
    return (
        PlantingPlan.objects
        .filter(project=project, season__isnull=True)
        .exclude(planting_date__isnull=True)
        .order_by('planting_date')
        .values_list('planting_date', flat=True)
        .first()
    )


def compute_setup_target_period(project: Project, pattern: SeasonPattern | None = None) -> tuple[date, date]:
    """Return the period the first-run setup (and the seeders) would assign unassigned plans to.

    Anchored on the earliest unassigned plan's `planting_date` rather than on
    today, so legacy data lands in the season matching its own history
    instead of whatever period happens to contain "today" when setup runs.
    Falls back to today only when every unassigned plan is missing a
    `planting_date` (or there are none).

    Accepts an optional in-memory `pattern` override (unsaved `start_day`/
    `start_month`) so callers can preview the effect of a not-yet-saved
    pattern choice, mirroring `SeasonPatternPreviewView`.
    """
    pattern = pattern or get_or_create_season_pattern(project)
    reference_date = earliest_unassigned_planting_date(project) or date.today()
    return compute_period_containing(pattern, reference_date)


def assign_unassigned_planting_plans(project: Project, *, owner=None) -> Season | None:
    """Put every season-less planting plan of `project` into a matching season.

    Used by the project seeders (demo and hint-test fixtures), which create
    planting plans directly instead of going through the API. Without this
    their plans would look like pre-season legacy data and trigger the
    first-run migration modal on a project that was just created.

    Returns None when there is nothing to assign.
    """
    unassigned = PlantingPlan.objects.filter(project=project, season__isnull=True)
    if not unassigned.exists():
        return None

    start_date, end_date = compute_setup_target_period(project)
    season = get_or_create_season_for_period(
        project,
        start_date,
        end_date,
        created_by=owner if owner and getattr(owner, 'pk', None) else None,
    )
    unassigned.update(season=season)
    return season
