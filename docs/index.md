# OpenFarmPlanner Technical Documentation

This is the technical documentation for OpenFarmPlanner, aimed at
developers and AI coding agents working in this repository. For setup
instructions and quick start, see the root [`README.md`](../README.md).
For contribution/commit conventions, see [`CONTRIBUTING.md`](../CONTRIBUTING.md).
For rules AI agents must follow when changing code, see [`AGENTS.md`](../AGENTS.md).

## Start here

- **[Architecture Overview](./architecture-overview.md)** — tech stack,
  backend/frontend structure, the project/user/permission model, and the
  main architecture/UX decisions worth knowing before changing things.
- **[Data Model](./data-model.md)** — the core domain objects and how they
  relate, with Mermaid diagrams. Not a full field reference.

## Complex features

- **[DataGrid Architecture](./datagrid-architecture.md)** — the custom
  layer OpenFarmPlanner built on top of MUI X DataGrid: inline editing,
  row actions, notes/markdown cells, copy/paste, column visibility.
- **[Demo Project Template](./demo-project.md)** — the reusable realistic
  demo dataset used by first-project onboarding and landing screenshots.
- **[Hint Test Project](./hint-test-project.md)** — reproducible developer
  fixture for hints, warnings, empty states, incomplete calculations, and
  related manual QA paths.
- **[Keyboard Navigation Architecture](./keyboard-architecture.md)** — the
  focus-region model and the shortcut/command system.
- **[Design System](./design-system.md)** — how the MUI theme and Tailwind
  CSS v4 divide the work, the cascade-layer setup that makes them coexist,
  the design tokens, and the RTL-safe utility rules.
- **[Form Layout](./form-layout.md)** — responsive field-width roles and the
  exceptions for grid editors, narrow popovers, and search controls.
- **[Occupancy Tree / Gantt Hierarchy](./occupancy-tree-hierarchy.md)** —
  the Standort → Parzelle → Beet tree in the bed-occupancy calendar, plus
  the Gantt calendar's context menu, drag-and-drop, and row-height model.
- **[Social Login](./social-login.md)** — Google/Microsoft sign-in via
  django-allauth: the OAuth flow, the account-linking rules, and the
  Google/Microsoft setup steps.
- **[Crop Library Architecture](./crop-library-architecture.md)** — the
  project-owned `Culture` vs. shared `PublicCulture` split, and the `crops`
  Django app that prepares (but doesn't yet expose) a public Crop Library.
- **[Internationalization (i18n)](./i18n.md)** — supported languages, how the
  UI language is resolved and stored, the crop-library translation model and
  its fallback rules, cross-language search and duplicate detection, and the
  data-migration assumptions.
- **[International Public Crop Library Data Model](./public-crop-library-data-model.md)** — the
  language-independent species/variety architecture, translation
  strategy, attribute inheritance, and incremental migration plan.
- **[Seed Demand Calculation](./seed-demand-calculation.md)** — how
  required seed amounts and package suggestions are computed, with worked
  examples.
- **[Versioning and History](./versioning-and-history.md)** — the
  `EntityRevision` audit trail and how culture/project restore works.
- **[Large-Dataset Rendering](./large-dataset-rendering.md)** — pagination,
  bulk-read limits, and scroll-driven windowing for large projects.
- **[`AUTOSAVE_IMPLEMENTATION.md`](../AUTOSAVE_IMPLEMENTATION.md)** —
  save-on-blur, validation-before-save, and navigation-blocking hooks
  (`useAutosaveDraft`, `useNavigationBlocker`).

## Process / QA

- [`qa-strategy.md`](./qa-strategy.md) — when to do a full vs. targeted
  exploratory QA sweep.
- [`qa-coverage-2026-06-30.md`](./qa-coverage-2026-06-30.md) (or a later
  `qa-coverage-*.md`, if one exists — use the most recent date) — what was
  last tested, at which commit.
- [`qa-excluded-issues.md`](./qa-excluded-issues.md) — known, intentional
  behavior that looks like a bug but isn't; don't re-report these.
- [`keyboard-shortcuts-audit.md`](./keyboard-shortcuts-audit.md) — shortcut
  inventory audit.

## Conventions used across these docs

- Mermaid diagrams for relationships/flows where they help; plain prose
  otherwise.
- A point marked **"unclear / needs check"** means the author could not
  verify it from the code alone — treat it as a question, not a fact.
- These docs describe *why* things are the way they are, not just *what*
  the code does — the code itself, plus inline comments at the specific
  non-obvious spots, is the source of truth for exact behavior.
