"""Weekly yield-distribution calculation for the yield calendar endpoint.

Aggregates each planting plan's expected yield across the ISO weeks its
harvest window overlaps, proportional to the overlapping days.
"""

from collections import defaultdict
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from farm.models import PlantingPlan, Project
from farm.services.culture_display import resolve_culture_display_name


def week_start_for_iso_year(iso_year: int) -> date:
    """Return Monday of ISO week 1 for an ISO year."""
    return date.fromisocalendar(iso_year, 1, 1)


def iso_week_key(day: date) -> str:
    """Return ISO week key in the format YYYY-Www using ISO year and week."""
    iso_year, iso_week, _ = day.isocalendar()
    return f"{iso_year}-W{iso_week:02d}"


def build_yield_calendar(
    project: Project,
    iso_year: int,
    language_code: str,
    season_id: int | None = None,
) -> list[dict[str, object]]:
    """Return the per-week, per-culture expected yield rows for one ISO year.

    Scoped to `season_id` when given, matching the active-season header the
    planting-plans list endpoint scopes by — see
    docs/seasons-architecture.md.
    """
    year_start = week_start_for_iso_year(iso_year)
    year_end = week_start_for_iso_year(iso_year + 1) if iso_year < 9999 else date.max

    plans = (
        PlantingPlan.objects
        .select_related('culture', 'culture__crop_species')
        .prefetch_related('culture__crop_species__translations')
        .filter(
            project=project,
            harvest_date__isnull=False,
            harvest_end_date__isnull=False,
            culture__expected_yield__gt=0,
            harvest_date__lt=year_end,
            harvest_end_date__gt=year_start,
        )
    )
    if season_id is not None:
        plans = plans.filter(season_id=season_id)

    weekly_data: dict[str, dict[str, object]] = {}
    for plan in plans:
        _accumulate_plan_yield(weekly_data, plan, iso_year, language_code, project.region)

    return _build_response_rows(weekly_data)


def _accumulate_plan_yield(
    weekly_data: dict[str, dict[str, object]],
    plan: PlantingPlan,
    iso_year: int,
    language_code: str,
    project_region: str,
) -> None:
    """Distribute one plan's expected yield over the ISO weeks it overlaps."""
    harvest_start = plan.harvest_date
    harvest_end = plan.harvest_end_date
    if harvest_end <= harvest_start:
        return

    total_days = (harvest_end - harvest_start).days
    if total_days <= 0:
        return

    expected_yield = Decimal(plan.culture.expected_yield)
    first_week_start = harvest_start - timedelta(days=harvest_start.weekday())
    week_start = first_week_start

    while week_start < harvest_end:
        week_end = week_start + timedelta(days=7)
        overlap_start = max(harvest_start, week_start)
        overlap_end = min(harvest_end, week_end)
        overlap_days = (overlap_end - overlap_start).days

        if overlap_days > 0:
            iso_year_of_week, _, _ = week_start.isocalendar()
            if iso_year_of_week == iso_year:
                iso_week = iso_week_key(week_start)
                week_entry = weekly_data.setdefault(
                    iso_week,
                    {
                        'iso_week': iso_week,
                        'week_start': week_start,
                        'week_end': week_end,
                        'cultures': defaultdict(Decimal),
                    },
                )
                culture_display_name, culture_display_language_code = resolve_culture_display_name(
                    plan.culture,
                    language_code,
                    project_region,
                )
                culture_key = (
                    plan.culture_id,
                    plan.culture.name,
                    culture_display_name,
                    culture_display_language_code,
                    plan.culture.display_color or '#3b82f6',
                )
                contribution = expected_yield * Decimal(overlap_days) / Decimal(total_days)
                week_entry['cultures'][culture_key] += contribution

        week_start += timedelta(days=7)


def _build_response_rows(weekly_data: dict[str, dict[str, object]]) -> list[dict[str, object]]:
    """Round and serialize the accumulated weekly data, dropping empty weeks."""
    response_data = []
    for iso_week in sorted(weekly_data.keys()):
        week_entry = weekly_data[iso_week]
        cultures_payload = []
        for (
            culture_id,
            culture_name,
            culture_display_name,
            culture_display_language_code,
            color,
        ), value in sorted(week_entry['cultures'].items(), key=lambda c: c[0][2] or c[0][1]):
            rounded_yield = value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            if rounded_yield <= 0:
                continue
            cultures_payload.append(
                {
                    'culture_id': culture_id,
                    'culture_name': culture_name,
                    'culture_display_name': culture_display_name,
                    'culture_display_language_code': culture_display_language_code,
                    'color': color,
                    'yield': float(rounded_yield),
                }
            )

        if not cultures_payload:
            continue

        response_data.append(
            {
                'iso_week': week_entry['iso_week'],
                'week_start': week_entry['week_start'].isoformat(),
                'week_end': week_entry['week_end'].isoformat(),
                'cultures': cultures_payload,
            }
        )

    return response_data
