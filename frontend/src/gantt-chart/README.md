# gantt-chart (vendored)

This directory contains the source of **React Modern Gantt**, vendored directly into OpenFarmPlanner as regular application source (no separate package, no separate build/publish step). It is used by [`frontend/src/pages/GanttChart.tsx`](../pages/GanttChart.tsx).

## Provenance and license

- Originally developed by Mika Stiebitz as [`react-modern-gantt`](https://github.com/MikaStiebitz/React-Modern-Gantt), MIT License.
- This copy was maintained as a fork at `stipsitzm/React-Modern-Gantt` (now archived) before being merged into this repository on 2026-07-02, with full git history preserved (see `git log -- frontend/src/gantt-chart`).
- Licensed under the **MIT License** — see [LICENSE](./LICENSE) in this directory for the full text and copyright notice, which is preserved here as required by that license. OpenFarmPlanner as a whole is licensed under AGPL-3.0 (see repository root `LICENSE`); MIT-licensed code such as this is compatible with inclusion in an AGPL-3.0 project as long as the original notice is retained, which this file and the adjacent `LICENSE` file do.

## Structure

- `src/` — component/service/util source (`GanttChart`, `TaskList`, `TaskRow`, hierarchy-label utilities, collision detection, etc.)
- `__tests__/` — Vitest tests (ported from the original project's Jest suite)

## Making changes

Treat this as regular OpenFarmPlanner frontend code — follow the conventions in the repository root [CLAUDE.md](../../../../CLAUDE.md), not the original project's separate guidelines (those no longer apply here).
