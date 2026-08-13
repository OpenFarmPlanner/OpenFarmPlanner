# QA Coverage — 2026-07-22

Targeted form-layout audit based on Git commit `3f4885b7` plus the form-width
changes in this branch. The previous full regression coverage remains recorded
in `qa-coverage-2026-06-30.md`.

## Audited areas

| Area | Viewports | Result |
|---|---|---|
| Culture create/edit form | 1440×1000, 390×844 | compact roles applied; labels fit; no horizontal overflow |
| Location create/edit form | 1440×1000 | short selects share a row; prose fields remain full width |
| Supplier create/edit form | 1440×1000 | name and website use the shared wide role |
| Project settings invite form | 1440×1000 | email, role, and action form one compact row |
| Account settings editors | automated regression | identity and password fields use bounded roles |
| Planting-plan mobile form | automated regression and build | short values wrap responsively |
| Culture and calendar filters | automated regression and build | constrained selects fill their field containers |
| Authentication forms | automated regression and build | single-column forms use a bounded content width |

## Verification

- Playwright measured desktop roles at 180, 224, 300, and 400 px.
- On the 390 px viewport, sampled culture fields measured 278 px inside the
  dialog and the dialog reported no horizontal overflow.
- No visible culture-form labels overflowed at the desktop viewport.
- Frontend test suite: 132 files, 1,220 tests passed.
- Production TypeScript/Vite build passed.
- Scoped ESLint passed with one pre-existing `SeedDemand.tsx` hook dependency
  warning. Repository-wide lint remains blocked by generated `.vite/deps`
  files and unrelated pre-existing React Compiler findings.

## Tooltip copy audit

A follow-up audit reviewed rendered MUI tooltips, full-cell explanations,
Gantt task details, topbar mode help, graphical controls, and tooltip labels in
the reusable Gantt component.

- Culture timing terminology now consistently uses `Wachstumszeit` for the
  interval from planting to first harvest and `Erntezeit` for the interval
  from first to last harvest.
- The Erntebeginn and Ernteende column headers explain their calculations
  separately, and unavailable cells name the exact missing interval.
- Seed-demand package explanations distinguish missing supplier ordering data,
  missing package sizes, unit-conversion failures, and unavailable totals.
- Hierarchy dimension tooltips explain the downstream planning impact, while
  graphical controls use localized, explicit action labels.
- Calendar harvest tasks no longer manufacture an `Erntezeitraum` note; the
  tooltip displays the planting-plan note only when one exists.
- Focused tooltip and related regression suite: 9 files, 171 tests passed.
- Full frontend suite after the audit: 133 files, 1,226 tests passed.
- Production TypeScript/Vite build passed; changed files have no new ESLint
  errors when the repository's pre-existing fast-refresh export rule failure is
  excluded.
- Playwright verified the rendered Erntebeginn, Ernteende, missing timing,
  seed-package, culture timing, missing-dimension, and graphical-control
  tooltips against the local hint-test project at 1600×1000.
- Targeted hint-project backend suite: 7 tests passed.
