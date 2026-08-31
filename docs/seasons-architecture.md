# Seasons Architecture

Seasons let a project split its planting plans into successive ~12-month
planning periods (e.g. "2026", or "25/26" for a season that doesn't align
with the calendar year). This doc covers the data model, the season-scoping
mechanism, the copy-data action, and the first-run migration for projects
that predate this feature.

## Data model

- **`SeasonPattern`** (`backend/farm/models/seasons.py`) — one row per
  project (`OneToOneField`), holding only `start_day`/`start_month`. Duration
  is deliberately not configurable: every season spans exactly 12 months from
  its start date (`farm/services/seasons.py:add_months`, which clamps the day
  when the target month is shorter, e.g. Feb 30 → Feb 28/29).
- **`Season`** — project-scoped (`project` FK), `start_date`/`end_date`,
  optional `custom_label` (set via "Umbenennen"), and soft-deleted via
  `deleted_at` — same convention as `Culture` (`ActiveSeasonManager` hides
  deleted rows from `objects`, `all_objects` doesn't). A season's `label`
  property is the custom label if set, otherwise `computed_label`: a
  four-digit year when the period runs exactly Jan 1–Dec 31 of one calendar
  year, otherwise a hemisphere-agnostic `"YY/YY"` span. The frontend mirrors
  this exact rule in `frontend/src/seasons/formatSeasonDate.ts`'s
  `computeSeasonLabel` for previews computed before a season exists server-side.
- **`PlantingPlan.season`** — nullable `ForeignKey(Season, on_delete=CASCADE)`,
  mirroring the `culture`/`bed` FK pattern (nullable + CASCADE, but the actual
  delete path is the soft-delete above, so the DB-level CASCADE never fires —
  see the application-level cascade below). Nullable specifically so
  pre-existing projects keep working until the first-run setup (below) assigns
  a season. Culture library and bed/field structure stay season-independent,
  per the feature's original scope.

## Deleting a season

`SeasonViewSet.destroy` soft-deletes the season and, in the same transaction,
**hard-deletes its planting plans** — a season "contains" its plans, so
removing it removes them. `PlantingPlan` has no soft-delete, so each plan is
deleted for real, but `_delete_planting_plans_with_season` records an
`EntityRevision` (`ACTION_DELETED`) per plan first, so:

- the deletions show up in the project version history grouped under one
  `BatchOperation` (`season_delete`) — one entry with a single "rückgängig
  machen" that recreates the season and its plans, not a dozen loose rows
  (see [versioning-and-history.md](./versioning-and-history.md#batch-operations-grouping-a-cascade)).
  `season_create`, `season_undelete` and `season_copy_data` batch the same way;
- `SeasonViewSet.undelete` (the 10s undo snackbar in the season switcher, and
  any later manual undelete) recreates them. It finds the season's most recent
  `ACTION_DELETED` revision and, via
  `_restore_planting_plans_deleted_with_season`, re-inserts every
  `planting_plan` whose latest revision at/after that timestamp is a deletion
  with `snapshot['season_id']` pointing at this season — keeping the original
  primary keys and skipping any plan a user had already deleted individually
  beforehand.

On the client, `useActiveSeason.deleteSeason` treats deleting the **active**
season as an active-season change: it repoints the stored id at the newest
remaining season and does the same full reload as `switchSeason`, so no
mounted page keeps showing the deleted season's (or, with the header now
absent, *every* season's) planting plans. The pending deletion is stashed in
`sessionStorage` (`pendingSeasonDeletionStorage`) so the undo snackbar
survives that reload; undoing an active-season deletion restores the season
and switches back to it. A `useEffect` also writes the resolved active-season
id back to `localStorage` whenever it falls back (stored id missing or stale),
so the `X-Season-Id` header is never dropped while the project has seasons.

## Season-scoping of planting plans

Planting plans are the only season-scoped entity. Everything downstream that
reads `PlantingPlan` scopes by the active season explicitly — there is no
free ride through a shared queryset, because the Gantt/occupancy calendar
goes through `/api/planting-plans/` (a `ModelViewSet`) while yield overview
and seed demand are plain `APIView`s that build their own querysets in
`farm/services/yield_calendar.py` and `farm/services/seed_demand.py`. Both
accept an optional `season_id` and both views resolve it from the request the
same way the planting-plans viewset does — via
`resolve_season_id_from_request()` — so all three surfaces stay consistent
even though they don't share a queryset.

Scoping works the same way project-scoping does (see
[architecture-overview.md](./architecture-overview.md)'s `X-Project-Id`
description), one level down:

- The frontend persists the active season id in `localStorage`, namespaced
  per project (`activeSeasonId:<projectId>`, see
  `frontend/src/seasons/activeSeasonStorage.ts`) so switching projects never
  leaks a stale season id from a previous one.
- `httpClient.ts`'s request interceptor reads it fresh per request and sets
  `X-Season-Id` alongside `X-Project-Id`.
- `resolve_season_id_from_request()` (`backend/farm/project_context.py`,
  alongside the project-header resolution) parses `X-Season-Id` into an int
  or `None`; every season-aware view calls this rather than parsing the
  header itself.
- `PlantingPlanViewSet.get_queryset()` (`backend/farm/planning/views.py`)
  filters by `season_id` when the header is present; `perform_create` injects
  it onto new plans the same way project injection works, unless the
  serializer payload already specifies a season explicitly. Without a usable
  active season the serializer rejects creation; `season IS NULL` stays
  reserved for rows that predate the feature — see the first-run setup below.
- `YieldCalendarListView`/`build_yield_calendar` and
  `SeedDemandListView`/`build_seed_demand_rows` take the same resolved
  `season_id` and filter their own `PlantingPlan` queries by it when present;
  omitting the header (or filtering by `None`) aggregates across every season
  of the project, unchanged from before seasons existed.
- Switching the active season reloads the page — the same deliberate choice
  `switchActiveProject` makes for projects, to guarantee no page holds stale
  cross-season state.
- The Anbaukalender's Gantt/occupancy timeline
  (`frontend/src/pages/GanttChart.tsx`) does **not** anchor its visible time
  axis to a calendar year. The axis follows the actual data range of the
  season's plans: `startDate` = the earliest `planting_date`, `endDate` = the
  latest relevant date (harvest end, falling back to the harvest date), even
  when that reaches past the season's end. The `planting_date` itself stays
  hard-clamped to the season boundary on the serializer side — only the *end*
  of the displayed axis may extend beyond the season. The range is computed
  globally across every Fläche/Standort/Parzelle so all rows share the same
  columns and stay comparable, and gaps in the middle of the range are never
  collapsed. The occupancy view and the seedling/Anzucht view each get their
  own range (`getOccupancyCalendarRange` / `getSeedlingCalendarRange` in
  `ganttChartUtils.ts`), because propagation starts before the planting date.
  The zoom levels (Tag/Woche/Monat/Quartal/Jahr) only change the column
  granularity, not the anchor. When a season has no plans at all, the axis
  falls back to the season's calendar year (`displayYear`, seeded once from
  `RootLayoutOutletContext.activeSeasonYear` — computed in `RootLayout.tsx`
  from `useActiveSeason()` and passed through the route `Outlet` context) and
  the existing empty state renders; no season-year-specific axis logic is
  needed beyond that fallback.
- The yield overview (`frontend/src/pages/YieldOverview.tsx`) used to carry a
  "Jahr" filter with the same season-start-year default. It was removed: the
  page is fully season-scoped through `X-Season-Id`, and for a
  non-calendar-aligned season the calendar-year filter was actively
  misleading. `YieldCalendarListView` now returns every ISO year the active
  season spans (`build_yield_calendar_for_season`) instead of a single year,
  so a Sep–Aug season is shown whole. `RootLayoutOutletContext.activeSeason`
  carries the full season down to the page, which uses it only to decide
  whether to draw the year-boundary marker on the chart (see below).

There is no server-persisted "last active season" (unlike
`UserProjectSettings.last_project`); it is a client-only, per-project
convenience that defaults to the newest season when unset or stale.

## Year-boundary marker on season-spanning axes

A season whose period crosses a calendar-year boundary
(`season.start_date.year != season.end_date.year`) makes any calendar-week or
month axis ambiguous — "KW01" can be either end of the range. The yield
overview chart marks this with a subtle dashed vertical line between the last
column of the old year and the first column of the new year, spanning the plot
area only (it stops above the axis-label row), with a hover/tap tooltip
"Jahreswechsel: `<year1>` → `<year2>`".

Implementation worth reusing for other season-spanning axes (e.g. the
Anbaukalender Gantt):

- The boundary index is derived from the rendered columns
  (`useYieldChartData` returns `yearBoundary`), not assumed — it is the first
  column whose calendar year differs from its predecessor. Works for both the
  week axis (calendar year of the week start) and the month axis.
- The marker is only drawn when the active season actually straddles a year
  (`YieldDistributionChart` gates on `activeSeason` from the outlet context) —
  a plain calendar-year season never needs it.
- `YieldYearBoundaryMarker` measures the boundary column's offset inside the
  `position: relative` plot container and re-measures via `ResizeObserver`.
  The tooltip uses `AppTooltip` with an explicit `open` boolean driven by
  `hovered || pinned`, where `pinned` toggles on click — the same
  hover-or-tap pattern the chart segments use, so it works on touch.
- The colour is a dedicated muted theme token (`palette.chart.yearBoundary`),
  deliberately outside the crop series palette.

## Copy-data action

"Daten übernehmen" (copy planting plans from one season into another) is a
single reusable action, not a per-entry-point special case:

- `farm/services/seasons.py::copy_planting_plans(source_season, target_season)`
  copies a fixed tuple of `PlantingPlan` fields (`PLANTING_PLAN_COPY_FIELDS` —
  excludes the PK, timestamps, and audit fields) and `bulk_create`s the
  copies against the target season. It is always additive: existing plans in
  the target season are never touched, matched, or replaced.
- `planting_date`, `harvest_date` and `harvest_end_date` are shifted forward
  (or back) by the whole-year gap between the two seasons' start dates
  (`PLANTING_PLAN_SHIFTED_DATE_FIELDS`), so a plan copied from 25/26 into
  27/28 keeps its month and day but moves two years on. Feb 29 clamps to
  Feb 28 when the shifted year is not a leap year (`add_months`). The shift is
  a whole number of years, so it works for any season pattern, calendar-year
  or not.
- `SeasonViewSet.copy_from` (`backend/farm/seasons/views.py`) is the API
  surface both entry points call: the "Daten aus Saison X übernehmen"
  checkbox when creating a suggested season, and "Daten übernehmen von…" on
  any existing season's row menu. Both go through
  `frontend/src/seasons/useActiveSeason.ts::copyDataInto`.
- `frontend/src/seasons/SeasonCopyDataDialog.tsx` is the shared dialog
  component for the second entry point; it shows a warning (not error)
  `Alert` when the target already has planting plans, since the copy adds to
  them rather than replacing them.

## First-run setup (migrating pre-existing projects)

Projects created before this feature have `PlantingPlan` rows with
`season IS NULL`. That state is reserved for them: ordinary API creation now
requires an active season up front, and the project seeders call
`farm/services/seasons.py::assign_unassigned_planting_plans` after building
their fixtures (`populate_demo_project`, `populate_hint_test_project`).
Without that, a freshly created demo project would greet its owner with the
migration modal below. `reset_project_demo_data` drops a project's seasons
along with the rest of its farm data so repopulating never accumulates them.

The planting-plans page also mirrors this rule in the UI: when a project has
no active season it shows a "Noch keine Saison angelegt" empty state with a
CTA into the shared suggested-season dialog, and plan creation is disabled
with an explanatory tooltip. If direct season creation would leave existing
unassigned plans outside the proposed period (planting date through harvest
end), the API rejects it with a structured
`season_unassigned_data_outside_period` error so the dialog can explain which
legacy plans conflict instead of silently retrying.

`SeasonSetupStatusView`/`SeasonSetupApplyView`
(`backend/farm/seasons/views.py`) drive a one-time modal
(`frontend/src/seasons/SeasonSetupDialog.tsx`, mounted from `RootLayout.tsx`
and gated on `seasonSetupAPI.status().needs_setup`):

1. Status reports the count of `season IS NULL` plans, plus the target
   period computed by `compute_setup_target_period()` — anchored on the
   *earliest unassigned plan's* `planting_date` (falling back to today only
   when every unassigned plan lacks one), not on today. Legacy data lands in
   the season matching its own history rather than whatever period happens
   to contain today when a user gets around to running setup. The endpoint
   also accepts `start_day`/`start_month` query params to preview the effect
   of a not-yet-saved pattern choice (mirroring
   `SeasonPatternPreviewView`) — `SeasonSetupDialog` re-fetches on every
   change to the day/month selects so the info box and summary line never
   show a stale period.
2. Applying the setup saves the chosen start day/month as the project's
   `SeasonPattern`, creates (or reuses, via `get_or_create`) the `Season` for
   that same earliest-plan-anchored period, and bulk-`update()`s every
   `season IS NULL` plan onto it in one query — no data is copied or
   duplicated, only the FK is set. `assign_unassigned_planting_plans()` (used
   by the seeders, see above) and the interactive setup endpoint now share
   the exact same `compute_setup_target_period()` anchor logic.
3. The dialog is gated off entirely on project-independent routes
   (`isProjectIndependentRoute()`, e.g. `/app/project-selection`) — it used
   to render as a global overlay there too, blocking the project list's own
   "Öffnen" buttons behind its modal backdrop.
4. Canceling the dialog hides it for the rest of the browser tab's session
   (`frontend/src/seasons/seasonSetupDismissal.ts`, backed by
   `sessionStorage` and keyed per project) — a plain in-app navigation *or* a
   full page reload both respect the dismissal now. It still reappears on a
   genuinely new visit (new tab, browser restart), since nothing about the
   underlying unassigned-plans state was actually decided. Before this fix,
   the dismissal lived only in in-memory React state and was lost on every
   reload, not just a new visit.

## Season pattern preview math

`backend/farm/services/seasons.py` is the single source of truth for period
math (`compute_season_period`, `compute_period_containing`,
`compute_preview_periods`, `compute_due_season_period`,
`find_due_but_missing_season`). For projects with existing seasons, the
switcher's suggestion is the configured pattern period immediately after the
chronologically latest season, regardless of today's date. Only a project with
no seasons uses the pattern period containing today as its initial suggestion.
The project settings "Saison-Muster" card
(`frontend/src/seasons/SeasonPatternCard.tsx`) and the season switcher's
due-season suggestion both call the same `/season-pattern/preview/` and
`/seasons/due-suggestion/` endpoints rather than re-deriving the math
client-side — the one exception is the label itself
(`computeSeasonLabel`), which is cheap and needed before a suggested
season exists as a row to read `label` off of.

## Known simplifications

- The "due season available" badge on the closed switcher pill is a plain
  MUI `Badge` dot with a tooltip; there is no separate compact popover
  distinct from the full dropdown menu.
- There is no dedicated `assertNumQueries` regression test for
  `/api/seasons/` beyond the one in `test_api_query_counts.py`; the
  `planting_plan_count` annotation is page-wide, not per-row, so it does not
  grow with the row count.
- "Daten übernehmen" shifts `planting_date`/`harvest_date`/`harvest_end_date`
  by the whole-year gap between the source and target season start dates (see
  the "Copy-data action" section), so copies land in the target season's own
  period rather than the source's. A copied `planting_date` can still fall
  just outside the target period if the two seasons' patterns differ, but for
  the common case (same pattern, N years apart) it stays in range.
- `PlantingPlan.planting_date` otherwise has a **hard boundary**: on API
  create/update `PlantingPlanSerializer` rejects a `planting_date` outside the
  target season's `start_date`–`end_date` range
  (`_validate_planting_date_within_season`), and the frontend constrains the
  date picker (the `PlantingPlans` grid's inline edit via `DateEditCell`'s
  `minDate`/`maxDate`, the mobile create/edit form via a helper text plus a
  submit-time check). The copy flow above is the one sanctioned way to
  produce an out-of-range date, because `bulk_create` bypasses serializer
  validation; the constrained editor then lets the user pull such a plan back
  into range. This boundary applies to `planting_date` only — harvest dates
  are still free (they are derived from culture timing and legitimately fall
  after a season's end).
- A season's `computed_label` is not guaranteed unique within a project:
  changing the season pattern repeatedly can produce two different date
  ranges that both compute to the same "YY/YY" label (e.g. two periods both
  reading "26/27"). The season list disambiguates via the date-range subtext
  shown under each label, and `custom_label` (rename) is the escape hatch,
  but there is no automatic collision detection.
