# AGENTS.md

## Language Rules
- All code must be written in English.
- All comments and docstrings must be in English.
- All variable names, function names, class names, and identifiers must be in English.
- All commit messages must be written in English.
- All API responses and application logs must be in English.
- All explanations, summaries, and code-related output from AI agents must be in English.
- UI text must remain in German and must be handled through i18n resources.
- Do not mix German and English within code.

## General Guidelines
- Follow the existing project structure and established patterns.
- Prefer consistency over introducing new patterns.
- Prefer type safety, including TypeScript types and Python type hints.
- Keep functions small, focused, and readable.
- Write clean, maintainable, and well-structured code.
- Reuse existing components before creating new abstractions.
- Avoid duplication (DRY).
- Refactor when repeated patterns appear.
- Prefer centralized solutions over page-specific fixes.

## Workflow: Before Making a Non-Trivial Change

A pre-flight checklist. Each point is a pointer — the full rule lives in
exactly one section below; don't restate rules here.

1. Read [`docs/index.md`](docs/index.md) and the deep-dive doc for the area
   you're touching. Those docs record *why* things work the way they do —
   re-deriving that from the code risks redoing a decision that was already
   made deliberately.
2. Preserve existing UX behavior unless the task explicitly asks to change
   it — see "Architecture Safety Rules" and "UX Consistency Rules".
3. Update affected documentation in the same change — see "Documentation
   Rules".
4. Don't fold unrelated refactors into the change — see "Refactoring
   Rules".
5. Run the relevant tests/lint before considering the task done — see
   "Testing Rules".

## Testing Rules
- Write or update appropriate tests for functional changes.
- New features should include tests for expected behavior.
- Bug fixes should include regression tests where possible.
- Behavior changes must update affected frontend, backend, or end-to-end tests where the repository already has coverage patterns.
- Prefer extending existing test files before creating new test structures.
- Follow existing test patterns used in the repository.
- Run targeted tests when appropriate unless the user explicitly says not to run tests.
- Typical commands:
  - Backend: `cd backend && pdm run test` (plus `pdm run makemigrations` / `pdm run migrate` if models changed).
  - Frontend: `cd frontend && npm run lint && npm run test` (add `npm run test:e2e` for user-facing flows with existing E2E coverage).
  - Or `./scripts/quality.sh` from the repo root to run the same gates CI uses.
- Do NOT execute CI workflows manually.

## Playwright Screenshot Tests
- Screenshot baselines must never be updated or committed automatically.
- If a screenshot test fails, first determine whether the visual change is intentional or indicates a bug.
- Only update baselines when:
  - the UI change is explicitly intended, and
  - the new screenshots have been visually reviewed.
- Add new screenshot tests only for stable, important layouts (e.g. main pages, navigation, responsive layouts).
- Prefer standard Playwright assertions (`toBeVisible`, `toHaveText`, `toBeFocused`, `toHaveValue`, etc.) for functional tests.
- When creating or changing a screenshot test, document why a screenshot test is appropriate over functional assertions.

## Documentation Rules
- Update relevant documentation when behavior changes: if the change touches
  architecture, the data model, or a documented complex feature, update the
  corresponding file under `docs/` (or the relevant top-level
  `*_IMPLEMENTATION.md`/`*_GUIDE.md` doc) in the same change — don't leave
  documentation describing the old behavior.
- Keep code comments minimal and useful.
- Prefer self-explanatory code over comments.
- Do not add routine file header comments. Add a short top-level comment only
  when a file's purpose, constraints, or domain assumptions are not obvious
  from its name and surrounding code.
- Update AGENTS.md only when project architecture or developer workflow changes significantly.
- Do not update AGENTS.md for small implementation details.

## Project Structure
- `backend/` contains the Django backend. The main apps are `accounts/` and `farm/` (whose views/serializers are organized into domain packages: `common/`, `history/`, `projects/`, `structure/`, `cultures/`, `planning/`, `notes/`, plus `services/` for business logic), with project settings in `config/`, app-local tests under each app, backend helper scripts in `backend/scripts/`, and generated media under `backend/media/`.
- `frontend/` contains the React + TypeScript app. Application code lives in `frontend/src/`, with pages, components, hooks, API clients, i18n resources, and frontend tests following the existing folder layout. Playwright end-to-end tests live in `frontend/e2e/`.
- `tests/` contains repository-level Python tests that are not tied to a single Django app.
- `scripts/` contains repository-level helper and maintenance scripts.
- `docs/` contains project documentation.
- `prompts/` contains saved prompt material used by the project.
- `.github/` contains GitHub Actions workflows and GitHub instruction files.

Follow existing placement patterns before creating new directories.

Deploy scripts, cron/scheduling config, and infra are **not** in this repo — they live in the separate `OpenFarmPlanner-ops` repo (sibling directory `OpenFarmPlanner-ops/`). Before concluding that a management command is never scheduled, or that a deploy/retention step is missing, check `OpenFarmPlanner-ops` (`cron.d/`, `deploy/`, `services.d/`) as well as this repo.

## Frontend Rules
- UI text must always use i18n resources.
- Never hardcode user-visible strings directly into components, dialogs, tables, filters, tooltips, snackbars, or form helpers.
- New or changed UI text must include German translations in the relevant i18n namespace.
- Never render raw enum values, backend field names, or technical API error payloads directly in the UI. Map them to user-friendly localized labels or messages first.
- Prefer reusable components over page-local implementations.
- Reuse existing layout and topbar patterns.
- Maintain responsive behavior.
- Avoid layout shifts during state changes.
- Use TypeScript for frontend code; do not introduce plain JavaScript where TypeScript is possible.
- Use PascalCase for component names and `useSomething` names for hooks.
- Prefer strongly typed props and avoid `any`.
- Avoid deprecated MUI APIs; use current patterns such as `slotProps.htmlInput` instead of `inputProps`.

## UI Consistency / OpenFarmPlanner Style
- When creating or modifying UI elements, always follow the existing OpenFarmPlanner design language.
- This applies especially to info boxes, warning boxes, validation messages, confirmation dialogs, empty states, snackbars and undo messages, context menus, hover actions, buttons, tables, DataGrid behavior, forms, and helper texts.
- Search the codebase for existing implementations before creating new UI patterns.
- Reuse shared components and established patterns whenever possible.
- Do not introduce new colors, spacing, icons, typography, border styles, or interaction patterns if an equivalent OpenFarmPlanner pattern already exists.
- Prefer extending an existing shared component over creating a page-specific variant.
- If several similar implementations exist, prefer the one used most consistently across the app.
- Keep wording, button order, severity levels, and interaction behavior consistent with comparable existing screens.

## Backend Rules
- Backend packages are managed with PDM. Use `pdm` commands and do not introduce `pip install`, `requirements.txt`, or `setup.py`.
- Follow PEP 8.
- Use Python type hints everywhere.
- New or changed Python functions and methods should include complete parameter and return type hints.
- Keep views thin.
- Put business logic into services where appropriate.
- Avoid database writes inside GET endpoints.
- Keep API responses predictable and stable.
- Use SI units internally for physical measurements stored in the database, and convert units only at system boundaries such as serializers, forms, or API layers.
- Document physical units in model `help_text`, docstrings, or API/schema descriptions where units are not obvious.

## GitHub Push Workflow
- This repository should use the SSH GitHub remote:
  `git@github.com:stipsitzm/OpenFarmPlanner.git`
- If origin uses HTTPS and a push is requested, switch to SSH.
- Assume SSH works unless push errors indicate otherwise.
- Never commit directly to `main`. Always work on a feature/fix branch and open a pull request, even for small changes.

## Release and Production Deploy Workflow
- Production deploys must use an exact release tag in the `OpenFarmPlanner`
  checkout. Before deploying production, run
  `git describe --tags --exact-match HEAD` from this repo and confirm it
  returns the intended `vX.Y.Z` tag.
- If `HEAD` is not exactly tagged, do not proceed as though the build is a
  release. Either deploy an existing tag intentionally, or create the release
  through the repository's existing version/release flow first.
- Use the existing version bump tooling for manual release preparation:
  `make bump-version TYPE={feat|fix|breaking}`. This updates the central
  backend version via `scripts/bump_version.py`; do not edit version files by
  hand when the script applies.
- The normal GitHub release flow is driven by Conventional Commits,
  `release:*` labels, and `.github/workflows/release.yml`, which creates tags
  using the `v{version}` format configured in `pyproject.toml`. If a merge to
  `main` should have produced a release tag but did not, inspect and fix the
  release workflow before production deploy instead of bypassing the tag check.
- Use `--allow-untagged` for production only when the user explicitly asks for
  an emergency untagged deploy and the final summary calls out the exact commit
  that was deployed.

## Commit and PR Title Rules

- Use Conventional Commits only:
  feat
  fix
  docs
  refactor
  test
  chore
  ci
  build
  perf

- Use feat/fix only for user-visible changes.
- Use refactor for structural changes without behavior changes.
- Keep commit and PR titles concise.

## Architecture Safety Rules
- Before introducing a new component, hook, utility, context, or abstraction:
  first check whether a similar solution already exists.
- Avoid parallel implementations of the same concept.
- Prefer extending existing systems over creating alternatives.
- Preserve existing UX behavior (interaction patterns, wording, confirmation
  flows, keyboard shortcuts) unless the task explicitly asks for the change.
  If a task's scope is ambiguous about whether a UX change is wanted, ask
  rather than assume.

## Refactoring Rules
- If code duplication appears in multiple places, suggest refactoring.
- Prefer extracting shared components over copy-pasting.
- Keep refactors incremental and low-risk.
- Do not fold an unrelated large-scale refactor into a feature/fix change,
  even if you notice something that could be improved — flag it separately
  instead.

## UX Consistency Rules
- Empty states should guide users toward the next action.
- Prefer contextual actions over disabled controls.
- Keep styling and interaction patterns consistent across pages.
- Reuse existing empty-state, dialog, and topbar patterns.

## Agent Collaboration Preferences
- When discussing how to approach a non-trivial task (architecture redesign, risky refactor, planning work), proactively recommend a reasoning-effort/model level (e.g. low/medium/high/xhigh, or a specific model) with a short rationale, before being asked.
- User-workflow/collaboration preferences like this one should be recorded here in AGENTS.md, not only in a tool-specific private memory, since AGENTS.md is the shared, centrally-linked ruleset read by all coding agents (Claude, Codex, Copilot, etc.).
- When changing the privacy policy or related legal texts, decide case by case whether the change only requires informing users or whether it requires renewed active consent from existing users. If renewed consent is necessary, implement the corresponding consent/version bump flow in the same change; if it is not necessary, state that explicitly in the summary.

## QA / Exploratory Testing
When asked to search for bugs, run exploratory tests, or do a QA sweep:
1. Read `docs/qa-strategy.md` first — it defines when to do a full vs. targeted sweep and contains Playwright setup details.
2. Read `docs/qa-coverage-*.md` (most recent date) — it lists which areas were last tested, at which git commit, and known UI patterns that look like bugs but are by design.
3. Read `docs/qa-excluded-issues.md` — do not re-report these won't-fix items.
4. After the session, update `docs/qa-coverage-*.md` with the new git commit reference and any newly confirmed areas.
