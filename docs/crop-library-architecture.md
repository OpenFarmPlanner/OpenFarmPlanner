# Crop Library / Farm Planning Architecture

Date: 2026-07-03
Scope: `backend/`, `frontend/src/`

Goal: prepare and evolve the architecture for a public Crop Library
(`/crops`) without splitting the repository unnecessarily. The library is
now treated as a long-lived, community-built knowledge base for crop data.
Users can withdraw their own accidental publications through a non-destructive
status transition; moderation and cleanup use stronger staff-only states.
The collaborative editing model is now direct: public entries have discussion
comments and immutable version history, while the import picker stays optimized
for quickly copying a crop into the active project.

## 0. Product and legal model

The public Crop Library follows an open-data model:

- Published crop data becomes part of a shared knowledge base intended to
  persist beyond the contributing user's project or account.
- Contributors may take their own publications back out of the library when a
  publication was accidental or needs correction. Withdrawal is
  non-destructive: the entry disappears from discovery, but attribution,
  license evidence, import lineage, and already-imported project copies remain
  intact. The UI offers this as a single "Aus Bibliothek entfernen" action.
- Moderator removal is reserved for exceptional cases such as test data,
  duplicates, unlawful content, personal data in a published record, spam,
  obvious abuse, or another moderation decision. It is also non-destructive.
- Public entries can be edited directly by logged-in users. Each edit is
  immediately published as the current public version and records an immutable
  `PublicCultureRevision` snapshot with author, timestamp, changed fields, and
  old/new values where they are displayable.
- The public entry identity is fixed after publication: `name`/`variety`
  (`Kulturart` + `Sorte`) define the public-library record and are not part of
  the wiki-style edit payload. The UI shows that identity as static context in
  the shared culture form, while the API rejects manipulated direct edit
  requests that try to change it.
- Reverting a public entry restores an older snapshot by creating another new
  version. It never deletes existing revisions.
- Public crop data is intended to be reusable through the app, future
  public APIs, future downloads/exports, and external open-source or
  commercial projects.
- Contributions are licensed under Creative Commons
  Attribution-ShareAlike 4.0 International (CC BY-SA 4.0). The license is
  suitable here because it allows copying, adaptation, redistribution, and
  commercial use while preserving attribution and share-alike conditions.
- A user's first publication must be a conscious act: the UI explains the
  persistence and license terms, and the backend records acceptance as
  `DocumentConsent.DOCUMENT_PUBLIC_LIBRARY`. This contribution consent is
  separate from the global Terms consent so it can be versioned and audited
  without blocking users who never publish.

Moderation uses non-destructive state transitions (`draft`, `published`,
`withdrawn`, `removed`) over hard deletes, so attribution, license evidence,
import lineage, and revision history remain auditable where legally
permissible. Hard delete is intentionally exceptional and only available to
administrators when no imports, source-project provenance, or other
dependencies remain.

Structured discussions use `PublicCultureDiscussionTopic` as a culture-owned
container and `PublicCultureDiscussionComment` for both top-level contributions
and replies. A nullable self-referencing `parent` preserves the exact reply
target while the frontend renders a real reply tree with capped visual
indentation, so deep discussions keep their logical parent chain without
shrinking the content column indefinitely.
The topic overview is activity-oriented: the API returns topics ordered by the
newest comment activity and includes the comment count, latest activity time,
latest comment preview, and optional revision reference needed for the compact
discussion list without per-topic comment fetches.
Topics may reference an immutable `PublicCultureRevision`, so the version being
discussed remains stable when newer revisions are created. Comments use soft
deletion (`deleted_at`/`deleted_by`) and retain their row and replies, with the
body cleared and a neutral placeholder shown in the UI. Normal authors may
soft-delete their replies and may delete the root discussion post only while no
visible, non-deleted replies remain. Public-library moderators may remove any
comment, including root posts with visible replies. Discussion topics with no
visible comments are hidden from the normal topic overview so users do not see
threads made only of deletion placeholders. Edits keep the original author and
creation timestamp and record `edited_at`. Existing pre-topic comments are
grouped per culture by migration 0081 into an `Allgemeine Diskussion` topic
without changing their authors, timestamps, text, or chronological order.

Discussion records and public revisions (`PublicCultureRevision`) do not
touch project-owned `Culture` rows. Editing or reverting a public entry changes
only the shared public-library row; projects that already imported an entry
continue using their private copied snapshot until a future explicit
update/merge flow is built.

The public crop-library page treats URL state as the source of truth for
navigable selections (`cultureId`, `tab`, `discussionId`). When users return
through the main navigation to the bare library route, the last valid
crop-library view state is restored from local storage and written back into
the URL; explicit URLs always override that saved state. Temporary UI state
such as drafts, edit forms, and reply targets is intentionally not restored.

Official `CropSpecies` rows are global master data and remain moderated. Users
may propose missing species from the publishing wizard, but proposed species
stay out of the official list until a public-library moderator approves them.
Approving a proposal promotes that same `CropSpecies` row to `published`;
rejecting it keeps an auditable rejected proposal.

Public-library moderators are granted through the Django group
`Public Library Moderators`, which carries only the `crops.moderate_crop_species`
permission. Staff/superusers inherit moderation capability for operational
management, but ordinary moderators do not receive Django admin or staff
rights. Normal users can request moderator access from account settings; admins
review those requests through the public-library moderation queue and approval
grants only the moderator group.

Legacy reviewed change proposals (`PublicCultureChangeProposal`) are retained
in the database for audit and transition safety. The active frontend no longer
creates, reviews, or displays them, and existing proposals are not
automatically applied.

## 1. The current situation (before this pass)

The domain split the long-term vision asks for — a public Crop Library
vs. project-scoped Farm Planning — **already existed at the data model
level**, just not as a formalized service/app boundary:

- **`Culture`** (`backend/farm/models/cultures.py`) is project-owned: it has a
  required `project` FK. Every project has its own private copy of every
  variety it grows, with growing parameters, supplier links, seed
  packages, and revision history (`CultureRevision`). This is Farm
  Planning data.
- **`PublicCulture`** (same file) is the shared library: no `project` FK
  of its own, only nullable *provenance* links (`source_project_culture`,
  `source_project`) recording where a published entry came from. This is
  Crop Library data.
- A bridge, `backend/farm/services/public_cultures.py`, copies data both
  ways: `publish_culture_to_public_library()` (a project's `Culture` →
  the library) and `import_public_culture_into_project()` (a library
  entry → a new project-owned `Culture`).
- `PublicCultureViewSet` (`/api/public-cultures/`) was already read-only
  and required only authentication — no project scoping at all, since a
  published crop isn't owned by any one project.
- The frontend already has an equivalent precedent for "routes outside
  the authenticated app": `frontend/src/pages/public/` (landing page,
  imprint, privacy policy) and `frontend/src/pages/auth/` (login,
  registration, ...) both render outside `/app`, gated only by
  `<ProtectedRoute />` wrapping the `/app` branch specifically. `/app` is
  already the prefix for the entire authenticated Farm Planning app; `/`
  is already the public root.

So the real work here was formalizing an existing, correct data split
into an explicit service/app boundary — not inventing the split from
scratch.

## 2. What this pass added

### Backend — a new `crops` Django app

`backend/crops/` is a real Django app (`INSTALLED_APPS`). It now owns
`CropSpecies`, the official language-independent species list used at the
publishing boundary. `PublicCulture` stays in `farm.models` — moving that
existing model to a different app changes its migration state and (without
careful `SeparateDatabaseAndState` migrations) its `app_label`-derived
`db_table`. That's a real risk to existing data, and still isn't
justified until the crop library is actually extracted into its own
service.

```
backend/crops/
  apps.py          CropsConfig
  models.py        CropSpecies, the official species list used by the
                    Publishing Wizard
  services.py      list_published_crops(), get_published_crop(),
                    find_exact_crop_match() — reads farm.models.PublicCulture,
                    nothing else
  serializers.py   CropSerializer (read-only; deliberately excludes
                    source_project/source_project_culture — see §3)
  views.py         CropViewSet (ReadOnlyModelViewSet, IsAuthenticated)
                    CropSpeciesViewSet (official list + proposed entries)
  urls.py          router → included at /api/crops/
  tests/
```

This is **additive**: `/api/public-cultures/` keeps working exactly as
before (still defined in `farm/cultures/views.py`/`farm/urls.py`, untouched) —
the current frontend keeps using it. `/api/crops/` and `/api/crops/<id>/`
are new, parallel endpoints with the same `IsAuthenticated` requirement
as everything else — **not actually public yet**. Making them public
later is a one-line permission-class change, not a rewrite.

`config/settings.py` (`INSTALLED_APPS`) and `config/urls.py` (both the
plain and legacy-prefixed mounts, matching how `farm.urls` is already
double-mounted) were updated to register the new app.

### Frontend — `frontend/src/crops/`

```
frontend/src/crops/
  api/cropsApi.ts        new client for /api/crops (list/get/match) —
                         NOT wired into any page yet
  components/
    PublicCultureLibraryDialog.tsx   moved from src/cultures/ (see §3)
  pages/                 empty (README explains what goes here later)
  hooks/                 empty (README explains what goes here later)
  index.ts               barrel (mirrors src/cultures/index.ts's convention
                         of exporting only the public-facing pieces)
```

`cropsApi.ts` exists so future code has somewhere to import from, but
`Cultures.tsx` / `PublicCultureLibraryDialog` still call the existing
`publicCultureAPI` in `api/api.ts` — switching the data source is a
separate, deliberate future step (see §5), not bundled into this
architecture pass.

`App.tsx` now exposes `/app/crop-library` (with `/app/crops` as an alias) as
an authenticated full-page public library workspace. The existing
`PublicCultureLibraryDialog` remains the quick import picker from the project
Crop Library page and links to the full page for details, version history, and
discussion.

## 3. The domain rule, and where it bites

> "Die Crop Library darf keinerlei Wissen über Projekte besitzen. Die
> Projektlogik darf lediglich die Crop Library verwenden."

Applied concretely:

- `crops/services.py`, `crops/serializers.py`, `crops/views.py` import
  only `farm.models.PublicCulture` and `farm.utils.normalize_text` — never
  farm's view/serializer packages, `Project`, or `Culture`. This is the
  one dependency direction that matters: if `crops` ever imported from
  farm's serializers, the arrow would point the wrong way (crop library
  depending on farm planning).
- `crops/serializers.py`'s `CropSerializer` is **not** a re-export or
  subclass of `farm.cultures.serializers.PublicCultureSerializer`, even though
  they're currently near-identical — importing it would create exactly
  that backwards dependency. It's a small, deliberate duplication.
- `CropSerializer` also deliberately **excludes**
  `source_project_culture`/`source_project` (present in the legacy
  `PublicCultureSerializer`) — those are project-provenance fields, and
  exposing them on the crop-library-facing surface would leak Farm
  Planning knowledge outward.
- The publish/import bridge itself (`farm/services/public_cultures.py`)
  is **not** moved into `crops`. It inherently needs both `Culture` and
  `Project` — it's a bridge, not a pure citizen of either domain. It's
  called "farm's dependency on the crop library" already (`farm/cultures/views.py`
  imports it), which is the correct direction; deciding whether it should
  someday become a real network call (once crops is an actual separate
  service) is future work, documented in §5, not solved now.
- `frontend/src/pages/usePublicCultureLibrary.ts` — the hook driving
  publish/import from the project Crop Library page — stays in `pages/` for the same
  reason: it's the Farm-Planning-side integration point, not
  crop-library-only logic (it reads/writes a project's `Culture` and
  needs a `selectedCulture`/`onImportSuccess` callback tied to that
  page's state).
- `frontend/src/cultures/CultureDetail.tsx` also stays where it is: it's
  reusable, prop-driven code, but the *data* it displays (a project's own
  cultures) is Farm Planning data, not the library. Only
  `PublicCultureLibraryDialog.tsx` — which genuinely only ever renders
  `PublicCulture[]` — moved to `crops/components/`.

## 4. Naming

New code in `crops/` uses "Crop" (`CropSerializer`, `CropViewSet`,
`cropsApi`, `Crop` type alias) per the task's naming rule. Existing
backend fields/models/endpoints (`Culture`, `PublicCulture`,
`/api/cultures/`, `/api/public-cultures/`) were **not** renamed — the
task explicitly allows deferring "umfangreiche Umbenennungen" rather than
risking them, and renaming a Django model/db column/serializer field
touches migrations, the DRF response shape, and every frontend call site
for no functional benefit right now. German UI text (`"Kultur"`,
`"Kulturbibliothek"`) is untouched, as required.

## 5. Deliberately NOT done (and why)

| Not done | Why | Future path |
|---|---|---|
| Moving `PublicCulture` (or `Culture`) into `crops.models` | Changes migration state / `app_label`-derived `db_table`; real risk to existing data for zero current benefit | A dedicated migration using `SeparateDatabaseAndState` to move the model's Django state into `crops` while keeping (or explicitly renaming, in one controlled step) the actual table |
| Removing/renaming `/api/public-cultures/` | Would break the current frontend (`publicCultureAPI`) — a functional change the task forbids | Once `Cultures.tsx`/`PublicCultureLibraryDialog` are switched to `cropsApi`/`/api/crops`, deprecate and remove the legacy path |
| Switching the frontend to actually call `/api/crops` | Not required to "prepare" the architecture, and swapping a working data source is exactly the kind of change to do deliberately and separately, with its own testing pass | Point `Cultures.tsx` at `cropsApi` instead of `publicCultureAPI`, delete the old client, delete `/api/public-cultures/` |
| A public, unauthenticated `/crops` route/page | The current collaboration and import workflow still needs an authenticated user and active project context | Split browsing from importing later: expose read-only public pages under `/crops`, keep project import under `/app` |
| Splitting `i18n/locales/*/cultures.json` into a `crops` namespace | Namespace holds both library- and farm-planning-flavored strings today; splitting now is pure churn for zero user-visible benefit | Split when `crops/pages/` gets real UI text to hold |
| Moving `Culture`/`CultureViewSet`/`CultureSupplierData`/`SeedPackage` into `crops` | These are genuinely Farm Planning (project-owned, or only meaningful attached to a project-owned `Culture`) — moving them would be the large, risky refactor the task asks to avoid | Not planned; these belong in Farm Planning long-term too |
| Fixing `PublicCultureLibraryDialog.tsx`'s cross-import of `stripCitationMarkers` from `components/data-grid/markdown`, or its two pre-existing `react-hooks/set-state-in-effect` lint errors | Both pre-date this move (confirmed by lint-checking the file at its old path before moving it) — fixing them isn't in scope for an architecture-only pass | A future cleanup could move the markdown helper to a shared, domain-neutral location |

## 6. Current user-facing surfaces

- Every existing API path (`/api/cultures/...`, `/api/public-cultures/...`)
  still works. New collaboration actions are additive child endpoints on
  `/api/public-cultures/<id>/`.
- The project Crop Library page still uses `PublicCultureLibraryDialog` for quick
  import into the active project.
- `/app/crop-library` is the full authenticated library workspace for
  browsing, importing, discussing entries, editing public crop data directly,
  reviewing versions, and restoring older versions.

## 7. Publishing Wizard quality gate

Publishing a project-owned `Culture` is no longer a direct copy action from
the project Crop Library page. The frontend opens `CulturesPublishingWizardDialog`,
which keeps the normal path intentionally small: the user selects the
official `CropSpecies`, confirms the original language, and clicks publish.
The dialog calls `/api/cultures/<id>/publish-public/preview/` only as a
background validation step when the user attempts publication, then shows
only actionable problems:

- official `CropSpecies` selected;
- exactly one original language selected (defaulted from the UI language);
- public-library required fields complete; and
- no published public duplicate for the same `CropSpecies` + normalized
  variety.

Missing translations remain optional and are not shown as a normal blocking
step. The existing CC BY-SA public-library contribution consent is also not
shown permanently; if it has not already been accepted, the dialog reveals it
immediately before the final publication action.

The backend enforces the same checks in
`farm.services.public_cultures.publish_culture_to_public_library()`, so the
wizard is not only a UI affordance. Private project cultures remain
flexible: `Culture.crop_species` is nullable, and incomplete project
cultures can still be created and edited. The strictness lives at the
public-library boundary where durable shared data is created. The official
species dropdown is seeded from `crops.seed_data.CROP_SPECIES_SEED_DATA`, a
central starter catalogue for common German and Austrian crop species whose
entries already carry stable keys and translation maps for the future
multilingual species library.

## 8. Withdrawal, removal, and hard delete

`PublicCulture.status` models the public-library lifecycle:

- `draft`: reserved for future review workflows;
- `published`: visible and importable from the public library;
- `withdrawn`: hidden by the contributor who published it;
- `removed`: hidden by an administrator or moderator with a required reason.

The status-change API lives on `/api/public-cultures/<id>/`:

- `remove/` is the single entry point for taking an entry out of the library,
  so the culture overflow menu only needs one "Aus Bibliothek entfernen"
  action. The actor decides the transition: the contributor of the entry
  withdraws it (`withdrawn`, no reason required, reversible by publishing the
  project culture again), while a moderator removing somebody else's entry
  must pass a structured reason (`accidental_publication`, `test_data`,
  `duplicate`, `wrong_mapping`, `unlawful_content`, `other`) and produces
  `removed`. Contributor intent wins for moderators acting on their own
  entries — a moderator who wants the stronger `removed` state for their own
  publication uses the admin surface.
  `CultureSerializer.owned_public_culture_role` (`contributor` / `moderator` /
  `null`) tells the UI which of the two paths applies, so the confirmation
  dialog only asks for a moderation reason when one is actually required.
- `hard-delete/` is staff-only and intentionally narrow. It is blocked when
  the public entry has imported project copies or source-project provenance;
  ordinary cleanup and moderation should use `removed` instead.
  Because it is exceptional, the normal culture overflow menu does not expose
  hard delete; it should live in a dedicated moderation/admin surface if a
  human-facing UI is needed later.

Every status transition writes `PublicCultureStatusEvent`, establishing the
audit trail needed for later moderation queues, review steps, duplicate
merges, restore actions, or richer status history. Public lists, duplicate
checks, match endpoints, and imports only expose `published` rows. Project
imports remain protected because importing creates a private `Culture` copy
with its own fields; status changes on `PublicCulture` never mutate already
imported project data.
