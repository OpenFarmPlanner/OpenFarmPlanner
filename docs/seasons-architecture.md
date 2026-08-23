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
  delete path is the soft-delete above, so CASCADE only fires on a real hard
  delete). Nullable specifically so pre-existing projects keep working until
  the first-run setup (below) assigns a season. Culture library and bed/field
  structure stay season-independent, per the feature's original scope.

## Season-scoping of planting plans

Planting plans are the only season-scoped entity; everything downstream that
reads `PlantingPlan` (Gantt/occupancy calendar, seed demand, yield overview)
is scoped for free because they all go through the same
`/api/planting-plans/` list endpoint.

Scoping works the same way project-scoping does (see
[architecture-overview.md](./architecture-overview.md)'s `X-Project-Id`
description), one level down:

- The frontend persists the active season id in `localStorage`, namespaced
  per project (`activeSeasonId:<projectId>`, see
  `frontend/src/seasons/activeSeasonStorage.ts`) so switching projects never
  leaks a stale season id from a previous one.
- `httpClient.ts`'s request interceptor reads it fresh per request and sets
  `X-Season-Id` alongside `X-Project-Id`.
- `PlantingPlanViewSet.get_queryset()` (`backend/farm/planning/views.py`)
  filters by `season_id` when the header is present; `perform_create` injects
  it onto new plans the same way project injection works, unless the
  serializer payload already specifies a season explicitly.
- Switching the active season reloads the page — the same deliberate choice
  `switchActiveProject` makes for projects, to guarantee no page holds stale
  cross-season state.

There is no server-persisted "last active season" (unlike
`UserProjectSettings.last_project`); it is a client-only, per-project
convenience that defaults to the newest season when unset or stale.

## Copy-data action

"Daten übernehmen" (copy planting plans from one season into another) is a
single reusable action, not a per-entry-point special case:

- `farm/services/seasons.py::copy_planting_plans(source_season, target_season)`
  copies a fixed tuple of `PlantingPlan` fields (`PLANTING_PLAN_COPY_FIELDS` —
  excludes the PK, timestamps, and audit fields) and `bulk_create`s the
  copies against the target season. It is always additive: existing plans in
  the target season are never touched, matched, or replaced.
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
`season IS NULL`. `SeasonSetupStatusView`/`SeasonSetupApplyView`
(`backend/farm/seasons/views.py`) drive a one-time modal
(`frontend/src/seasons/SeasonSetupDialog.tsx`, mounted from `RootLayout.tsx`
and gated on `seasonSetupAPI.status().needs_setup`):

1. Status reports the count of `season IS NULL` plans, plus the season
   pattern's currently-computed period (defaulting to Jan 1 if the project
   never configured one).
2. Applying the setup saves the chosen start day/month as the project's
   `SeasonPattern`, creates (or reuses, via `get_or_create`) the `Season` for
   the period containing today, and bulk-`update()`s every `season IS NULL`
   plan onto it in one query — no data is copied or duplicated, only the FK
   is set.
3. Canceling the dialog just hides it for the current session
   (`seasonSetupDismissed` in `RootLayout.tsx`) — it reappears next visit,
   since nothing was decided.

## Season pattern preview math

`backend/farm/services/seasons.py` is the single source of truth for period
math (`compute_season_period`, `compute_period_containing`,
`compute_preview_periods`, `compute_due_season_period`,
`find_due_but_missing_season`). The project settings "Saison-Muster" card
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
