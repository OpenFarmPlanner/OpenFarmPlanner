# Crop Library / Farm Planning Architecture

Date: 2026-07-03 (implementation status reviewed against the code 2026-08-12)
Scope: `backend/`, `frontend/src/`

## Implementation status at a glance

This document describes **shipped behaviour**; where it talks about future
work it says so explicitly (mainly §5, "Deliberately NOT done"). The separate
[public-crop-library-data-model.md](./public-crop-library-data-model.md) is the
opposite: apart from the parts it explicitly marks as shipped, it is a *target
model and migration plan*, not a description of the current schema. When the
two disagree about what exists, this file wins.

| Area | Status |
|---|---|
| `crops` Django app with `CropSpecies` (+ translations) and a moderator-request model | **implemented** |
| Publishing wizard (species mapping, original language, duplicate gate, species proposals) | **implemented** |
| Duplicate detection on `crop_species` + normalized `variety` (cross-language) | **implemented** |
| Direct wiki-style editing of public entries + immutable `PublicCultureRevision` history + revert | **implemented** |
| Threaded discussions (`PublicCultureDiscussionTopic` → `…Comment`, soft delete) | **implemented** |
| Non-destructive lifecycle (`draft`/`published`/`withdrawn`/`removed`) + status events + staff hard delete | **implemented** |
| Moderation surfaces: species proposals, moderator-access requests, restoring removed entries (`/app/public-library-moderation`) | **implemented** |
| Full library workspace at `/app/crop-library` (browse, import, discuss, edit, versions) | **implemented** |
| `PublicCultureChangeProposal` review workflow | **legacy** — model, endpoints and API-client wrappers still exist, no UI creates or reviews them (see §0) |
| `/api/crops/` as the *only* library surface; frontend switched off `/api/public-cultures/` | **not done** — see §5 |
| Unauthenticated public `/crops` route | **not done** — see §5 |
| Separate `CropVariety` entity and species→variety attribute inheritance | **not done** — planned in public-crop-library-data-model.md §2 |

### Naming: code/domain term vs. UI label

Throughout this repository the *domain* term is "public Crop Library": it names
the `crops` Django app boundary, the `Public*` models, the `/api/crops/`
surface, and the `PublicCropLibraryPage` component. The *user-facing* label,
however, is plain **"Kulturbibliothek"** (German) / **"Crop library"**
(English) — the word "öffentlich"/"public" was dropped from the UI because the
library is the only crop library users navigate to. Legal texts in
`home.json` (privacy policy, terms of service) deliberately keep the explicit
"öffentliche Kulturbibliothek" / "public crop library" wording, because the
public nature of publishing is what those sections describe. Do not rename
code identifiers to match the UI label.

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
- The public entry identity is fixed after publication in one direction only:
  `name` (`Kulturart`) can never be changed through the wiki-style edit
  payload — the API rejects manipulated direct edit requests that try to
  change it, and the UI shows it as static, read-only context in the shared
  culture form. `variety` (`Sorte`) is the one exception: an admin editing a
  public entry may correct the variety name (typo fixes) through the same
  edit payload as any other editable field. The identity uniqueness invariant
  from publish time still applies — `update_public_culture_directly()`
  rejects a rename that would collide with another published entry for the
  same species/name (`find_public_culture_identity_conflict()`, 409
  `public_culture_variety_conflict`). Because imported project cultures are
  linked by a stable `source_public_culture` foreign key rather than by name,
  a variety rename propagates through the existing re-import/update model
  (`import_public_culture_into_project()`) exactly like any other field edit:
  the linked project culture picks it up on its next explicit
  update/re-import, or the confirm-required conflict dialog if it has local
  edits (the 409 response there also flags `variety_changed` so the frontend
  can call the identity change out explicitly instead of blending it into a
  generic warning).
- Nothing about that model is automatic, but it is no longer invisible.
  `CultureSerializer.public_update_available` compares the copy's
  `source_public_version` against the linked entry's current `version` — the
  same comparison `import_public_culture_into_project()` makes — so the private
  culture view can show a notice that the library moved on.
  `GET /api/cultures/<id>/public-update/` then returns the field-level diff,
  derived from `CULTURE_COPY_FIELDS` (exactly what an update overwrites, so a
  renamed `variety` can never be applied without appearing in the preview).
  The endpoint is read-only: confirming in the dialog calls the existing
  `public-cultures/<id>/import/` action with `mode=update`, so the private
  culture page and the library page share one import/update path.
- Declining a public change is a third, explicit outcome next to applying and
  cancelling. `POST /api/cultures/<id>/public-update/reject/` stores
  `Culture.rejected_public_version` and touches no library-sourced field, so the
  notice disappears for exactly that version while the local copy stays as it
  was. Because the decision is a *version number* rather than a flag, a later
  public edit produces a version the user never decided on and the notice comes
  back on its own; taking an update over (`build_project_culture_payload`)
  clears the rejection again. Cancelling remains the "no decision" path — the
  notice returns on the next visit.
- The diff stays reachable after a decision: `build_public_culture_update_status()`
  is still built for a rejected version, and the culture detail header carries a
  permanent, quiet marker next to the "Importiert" badge
  (`PublicCultureUpdateMarker`) that reopens the dialog whenever the copy and
  the library version differ. Both entry points share one
  `usePublicCultureUpdate` controller, so the notice and the marker can never
  disagree about what is loading, applying, or rejecting.
- `CultureSerializer.public_publish_blocked_reason` locks the "Öffentliche
  Kulturbibliothek aktualisieren" action while pushing the local copy would be
  wrong: `update_pending` (undecided library change), `update_rejected` (the
  user declined that public version — pushing would silently undo exactly the
  change they declined), and `no_local_changes` (aligned copy with nothing to
  contribute). The lock is not only cosmetic:
  `publish_culture_to_public_library()` raises `PublicCultureUpdateBlockedError`
  (409 `public_culture_update_blocked`) for the two divergence cases before the
  quality gate runs. The action becomes available again once the copy is
  aligned with the current public version *and* carries local edits made after
  that.
- The publishing wizard's comparison covers `variety` too. Before the Sorte
  became editable it was left out as immutable, which meant publishing an
  update could rename the public entry without the change ever appearing in
  the "Änderungen vor der Veröffentlichung" table. It is skipped only for a
  species-level publish, where the backend forces an empty variety anyway.
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

Crop species display names are language- and region-aware at the API boundary.
The canonical German translation is standard Germany terminology; Austria and
Switzerland are explicit regional overrides on `CropSpeciesTranslation`, while
free synonyms are search/matching aliases only. Project-scoped requests resolve
the active `Project.region` from the normal project context (`X-Project-Id` /
`request.active_project`) and pass it through shared display helpers, so Gantt,
planning, culture detail, public-library and import surfaces render the same
name without frontend-specific region logic.

Private project cultures are intentionally independent from that public master
data. `Culture.crop_species` stays nullable and the "Add crop" dialog never
requires linking to a public entry — free text remains valid at all times and
never creates or proposes a public entry.

The "Add crop" dialog's `Kulturart` ("Name") and `Sorte` ("Variety") fields
are two separate suggestion sources
(`frontend/src/cultures/publicCultureNameSuggestions.ts`,
wired up in `CultureForm.tsx`/`BasicInfoSection.tsx`): the Name field
suggests deduplicated public crop species names only (one option per
`crop_species`, never a "Species · Variety" combination), and the variety
fields only offer suggestions — fetched via
`GET /api/public-cultures/?crop_species=<id>` — once the typed name exactly
matches one of those species suggestions; otherwise they stay free text.
Both suggestion sources filter out entries whose name or variety looks like
manual-QA test data (`isLikelyTestPublicCultureEntry`) — a display-only
filter; no public-library rows are deleted for this.

Selecting a Name suggestion links `crop_species` immediately and then copies
the species' general ("no variety") public entry into the draft — baseline
values plus `source_public_culture`/`source_public_version` and
`origin_type: 'imported'`, i.e. exactly the shape the "Import from library"
button produces, so the re-import/update model in
`import_public_culture_into_project()` applies to these cultures unchanged.
The copy reuses the species rows the Variety field fetches anyway (guarded by
`loadedVarietySpeciesId`, since an empty list is otherwise ambiguous between
"still loading" and "no entries"), so no extra request is made. A species with
no general entry — mostly legacy data, since `ensure_general_public_culture()`
creates one on publish — stays linked by `crop_species` alone rather than
copying an arbitrary variety's values. Species-level prefill never overwrites
a variety the user already typed (`preserveVariety`).

Which variety field is shown depends on `formKind`. The Add-**variety** dialog
renders the real `variety` field, and selecting a suggestion there copies that
concrete `PublicCulture` row. The Add-**crop** dialog has no `variety` field at
all; its optional "Sorte (optional)" field names a *second* culture created
after the crop, so picking a suggestion there only records which library entry
it came from and the linked draft is built at save time
(`FirstVarietyDraft.draft`, applied in `Cultures.tsx`'s `handleSave`). Leaving
it as free text keeps the pre-existing behavior of inheriting the crop's own
values. This split is why the Add-crop dialog must prefill from the Name field:
regression `#444`-era code put prefill exclusively on the `variety` field,
which that dialog never renders, leaving the public library unreachable from
"Kultur hinzufügen" while suggestions still appeared to work.

When the typed crop name already matches a private culture in the project, the
dialog shows a non-blocking info hint offering the existing "+ Add variety"
flow for that crop (`onSwitchToAddVariety`, resolved to the species-level row).
The match is computed against the already-loaded `cultures` prop — the
`duplicate_check` endpoint cannot serve this, since it returns `exists: false`
whenever `variety` is empty. Creating a free-text duplicate stays possible.

Only the publishing wizard requires a public-library decision: users either
link the private culture to an existing published `PublicCulture`, or continue
the existing new-public-entry flow after choosing an official `CropSpecies`.
When the user owns the linked public entry, the publishing wizard loads that
entry before submission and shows a field-by-field comparison of changed
public values against the private culture. An unchanged private culture cannot
create a redundant public version; confirmation explicitly updates the linked
public entry rather than merely linking it again.

The project Crop Library and the full public Crop Library now render the same
species → variety hierarchy. A public or private row with a selected
`crop_species` and an empty `variety` is the current "general crop" entry for
that species. Rows with a variety are rendered below that species. The UI uses
plain user-facing wording and a subtle visual cue for variety-specific values;
it does not expose implementation terms from the target data model. Until the
future `CropVariety` entity and persisted nullable override chain exist,
value-source cues are resolved from the current row plus the matching
no-variety general crop row.

The project page's "Kultur suchen" field renders that same hierarchy in its
dropdown (`CultureSearchSelect.tsx`, grouping built by
`cultureSearchOptions.ts` from `buildCropHierarchy`): one group per Kultur,
the general entry as the group's header row and its Sorten indented below it.
The header is an option rather than a plain group label, so arrow-key
navigation walks headers and Sorten in one sequence and Enter on a header
selects the general Kultur, exactly like clicking it; the surrounding
`role="group"` names the Kultur for screen readers, which is why the Sorte
rows can drop the repeated Kultur name. Because the page has already filtered
the options it passes down, the dropdown switches Autocomplete's own text
filter off — filtering twice would drop the very headers a variety hit needs.

Filtering the page by a Sorte name keeps that Sorte's Kultur in the list
(`withGroupGeneralCultures`), in the tree and the dropdown alike. Without it a
group whose Kultur row was filtered away left a Kultur node with no data of
its own: clicking it selected the first matching Sorte instead of the Kultur.
The re-added Kultur is context for the matches and never a match itself, so an
otherwise empty result still shows the "no cultures found" state.

Public-library moderators are granted through the Django group
`Public Library Moderators`, which carries only the `crops.moderate_crop_species`
permission. Staff/superusers inherit moderation capability for operational
management, but ordinary moderators do not receive Django admin or staff
rights. Normal users can request moderator access from account settings; admins
review those requests through the public-library moderation queue and approval
grants only the moderator group.

Discoverability of pending items is deliberately reused, not duplicated: the
"Moderation" topbar button (`PublicCropLibraryPage.tsx`) shows an MUI `Badge`
with the same counts the moderation queue itself lists — proposed species
always, pending moderator-access requests only for admins, since only admins
can review those — fetched with `page_size: 1` against the existing
`/api/crop-species/` and `/api/public-library/moderator-requests/` list
endpoints rather than a separate count endpoint. Submitting either kind of
item also fans out an in-app notification (see `docs/notifications.md`) to
every moderator/admin, so the queue is discoverable even off the crop library
page — the button badge and the bell read the same underlying pending state,
just through two different existing surfaces.

Legacy reviewed change proposals (`PublicCultureChangeProposal`) are retained
in the database for audit and transition safety. No UI creates, reviews, or
displays them any more, and existing proposals are not automatically applied.
The plumbing underneath is still there and still reachable: the model, the
`change-proposals/` list/create/approve/reject actions on
`PublicCultureViewSet`, and the `publicCultureAPI.changeProposals(...)` /
`createChangeProposal` / `approveChangeProposal` / `rejectChangeProposal`
wrappers in `frontend/src/api/api.ts` all still exist — only the components
that used to call them are gone. Treat it as dead-but-live surface: don't build
on it, and don't assume removing it is a no-op for API clients.

### Sorte → Kultur value inheritance

The species → variety pairing described above (a general "no variety" row plus
the rows that carry a variety) is also the **value** fallback for project
cultures, not only a display cue.
`backend/farm/services/culture_inheritance.py` owns the rule so the API, the
planning calculations and the UI resolve it identically:

- A Sorte (`variety` set) with a `crop_species` inherits from the general
  Kultur — same project, same `crop_species`, empty `variety`, not soft-deleted.
  A free-text Sorte without a `crop_species` has nothing to fall back to and
  always resolves to its own values.
- `CULTURE_INHERITABLE_FIELDS` lists the planning fields that participate. It
  mirrors the frontend's `VARIETY_INHERITABLE_FIELDS`
  (`frontend/src/cultures/varietyValueSource.ts`), which prefills a *new*
  Sorte from the same set, minus `allow_deviation_delivery_weeks` (a non-null
  boolean has no unset state to fall back from) and minus the legacy
  `seed_rate_value`/`seed_rate_unit` pair and the derived
  `seed_rate_by_cultivation` map (validated as a subset of the row's own
  `cultivation_types`, so inheriting it separately could produce a combination
  the model rejects).
- "Unset" means `None`, blank text, the legacy `'-'` unit placeholder, or an
  empty collection. `0` and `False` are real values and are never replaced.
- Nothing is copied onto the Sorte. Clearing a field removes the override, and
  the Sorte follows later edits of the general Kultur automatically.
- Creating or editing a linked Sorte always ensures that its project has a
  general Kultur row for the same species. Species-invariant fields
  (`crop_family`, `nutrient_demand`, `rotation_break_years`) fill empty general
  values automatically because they describe the crop species, not a variety.
  Variety-variable timing, yield, spacing, and seed fields flow back only
  through the create API's optional `copy_values_to_culture` flag (default
  `false`), and then only into general fields that are still unset. Existing
  general values are never overwritten.
- Publishing a Sorte to the public library, or linking one to an existing
  public entry, records the chosen `crop_species` on the *whole* local Kultur
  group rather than on that Sorte alone
  (`sync_crop_species_across_culture_group`). A group whose rows are still
  grouped by name alone would otherwise split in two the moment one of its
  Sorten is published — the published Sorte under the species, the general
  Kultur and the remaining Sorten under the name — which shows as two Kulturen
  of the same name in the culture tree and cuts the published Sorte off from
  its general Kultur's values. Rows that already carry a different species are
  a separate group and stay untouched.

`CultureSerializer` exposes the raw and the resolved value side by side, so a
client can tell them apart per field:

| Field | Meaning |
|---|---|
| the plain culture fields | always the row's **own** stored values |
| `general_culture` | id of the Kultur this Sorte inherits from, else `null` |
| `inherited_fields` | API field names whose effective value comes from that Kultur |
| `effective_values` | effective value per inheritable field, in the same API units as the plain fields (centimeters, normalized seed-rate units) |

`effective_values` and `inherited_fields` are empty whenever `general_culture`
is `null` — for a general Kultur or a free-text Sorte the plain fields already
*are* the effective values. Resolving a whole list page costs **one** extra
query: the serializer builds a per-request `crop_species → general Kultur` index
for the active project (`build_general_culture_index`) instead of looking up a
sibling per row.

**Planning reads effective values.** `PlantingPlan.calculate_effective_harvest_dates()`
is the shared side-effect-free calculation behind
`recalculate_harvest_dates()` and `_get_active_period()`. The
`PlantingPlanSerializer` uses the same calculation as a read-time fallback when
the stored `harvest_date`/`harvest_end_date` snapshot is empty, so old plans
also show a computed Erntende once their Sorte can inherit the missing timing
from its Kultur. The `culture_*` timing/cultivation fields the Gantt calendar
plans from and the plant-count conversions also resolve through the service. On
the frontend the same is true of `ganttChartUtils.ts`,
`locationDerivedTasks.ts` and the "missing duration" tooltip in Anbaupläne, via
`getEffectiveCultureValue`.

`Culture.plants_per_m2` is part of that: the model property still computes from
the row's own spacing, but the serializer publishes the **effective** value.
Both sides of the plants/area coupling have to agree — the Anbaupläne grid
decides whether the "Pflanzen" cell is editable from `culture.plants_per_m2`
while the row's `plants_count` comes from the plan serializer, so leaving the
culture field on own spacing makes an inheriting Sorte show a plant count the
grid then refuses to let the user edit (and Tab skips the cell).

Stored harvest dates remain a **write-time snapshot**, but reads can derive a
missing date from the current effective timing without writing it back. The
snapshot is recomputed when a plan is saved, when its own culture timing
changes, and when a general Kultur timing change affects Sorten that inherit
that exact field. Existing plans are not bulk-recalculated during deployment or
from GET endpoints just because a value became resolvable through inheritance.

**The edit dialog.** `CultureForm` merges the resolved values into the form
(`buildInheritedValueBaseline`), so a field the Sorte does not override shows
the Kultur's value rather than an empty input. Those values equal the Kultur's,
so `getVarietyOwnValueSource` reports no override and the green highlight keeps
marking genuine per-Sorte values only. On save, anything still matching the
baseline is cleared again (`stripValuesMatchingBaseline`, the same mechanism the
add-variety prefill uses), so displaying an inherited value never freezes it as
an override, and clearing a field simply removes the override.

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

`backend/crops/` is a real Django app (`INSTALLED_APPS`). It owns the official
language-independent species list used at the publishing boundary, plus the
moderator-access queue. `PublicCulture` stays in `farm.models` — moving that
existing model to a different app changes its migration state and (without
careful `SeparateDatabaseAndState` migrations) its `app_label`-derived
`db_table`. That's a real risk to existing data, and still isn't
justified until the crop library is actually extracted into its own
service.

```
backend/crops/
  apps.py          CropsConfig
  models.py        CropSpecies              official species list (published /
                                             proposed / rejected), used by the
                                             Publishing Wizard
                   CropSpeciesTranslation   (species, language_code) → common_name,
                                             regional_names, synonyms/search index
                   PublicLibraryModeratorRequest  moderator-access requests
  permissions.py   is_public_library_moderator() / is_public_library_admin(),
                    the `Public Library Moderators` group and the
                    `crops.moderate_crop_species` permission
  seed_data.py     CROP_SPECIES_SEED_DATA — the starter species catalogue with
                    stable keys and de/en names
  services.py      list_published_crops(), get_published_crop(),
                    find_exact_crop_match() — reads farm.models.PublicCulture,
                    nothing else
  serializers.py   CropSerializer (read-only; deliberately excludes
                    source_project/source_project_culture — see §3),
                    CropSpecies + moderator-request serializers
  views.py         CropViewSet (ReadOnlyModelViewSet, IsAuthenticated)
                    CropSpeciesViewSet (list/propose + moderator approve/reject)
                    PublicLibraryModeratorRequestViewSet (request/mine +
                     admin approve/reject)
  urls.py            router → /api/crops/
  species_urls.py    router → /api/crop-species/
  moderation_urls.py router → /api/public-library/moderator-requests/
  migrations/, tests/
```

Note that only `CropViewSet` is read-only. `CropSpeciesViewSet` and
`PublicLibraryModeratorRequestViewSet` are `ModelViewSet`s that accept writes
(species proposals, moderation decisions, access requests), so "the crops app
is a read-only surface" — true when this doc was first written — no longer
describes it.

The `/api/crops/` surface is **additive**: `/api/public-cultures/` keeps working
exactly as before (still defined in `farm/cultures/views/public.py` and mounted
through `farm/urls.py`, untouched) — the current frontend keeps using it.
`/api/crops/` and `/api/crops/<id>/` are parallel endpoints with the same
`IsAuthenticated` requirement as everything else — **not actually public yet**.
Making them public later is a one-line permission-class change, not a rewrite.

`config/settings.py` (`INSTALLED_APPS`) and `config/urls.py` register the app.
All three crops mounts exist twice in `config/urls.py`, plain and
legacy-prefixed, matching how `farm.urls` is already double-mounted.

### Frontend — `frontend/src/crops/`

```
frontend/src/crops/
  api/cropsApi.ts        client for /api/crops (list/get/match) —
                         still NOT wired into any page; only its own test
                         imports it
  components/
    PublicCultureLibraryDialog.tsx     the quick import picker, moved from
                                        src/cultures/ (see §3)
    PublicCultureFiltersPopover.tsx    library filter UI
    MultilingualTextFieldSection.tsx   per-language text editing
    publicCropLibrary/                 detail/discussion/version building
                                        blocks (CommentForm, DiscussionComment,
                                        VersionCard, ImportConflictDialog,
                                        DetailPrimitives, the mobile selector,
                                        formatters)
  pages/
    PublicCropLibraryPage.tsx      /app/crop-library — the full workspace
    PublicLibraryModerationPage.tsx /app/public-library-moderation
  hooks/                 still empty (README explains what goes here later)
  publicCultureDisplay.ts, publicCultureFilters.ts,
  publicCultureListMerge.ts, publicCropLibraryCommandSpecs.ts
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

- `crops/services.py` imports only `farm.models.PublicCulture` and
  `farm.utils.normalize_text` — never farm's view/serializer packages,
  `Project`, or `Culture`. This is the one dependency direction that matters:
  if `crops` imports from farm's serializers, the arrow points the wrong way
  (crop library depending on farm planning).
- **The rule has two live exceptions today, and they are worth knowing
  about before you extract the app.** `crops/serializers.py` imports
  `get_public_user_label` from `farm.cultures.serializers.public`, and
  `crops/views.py` imports `guest_demo_forbidden_response` /
  `is_active_guest_demo_user` from `accounts.demo_access`. Neither touches
  `Project` or `Culture`, so the *data* boundary still holds, but the import
  graph is no longer strictly one-directional. If `crops` is ever pulled out
  into its own service, these two are the concrete things that have to move
  (a shared display-label helper) or be re-expressed at the boundary (a guest
  check the crop library cannot make on its own).
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
  called "farm's dependency on the crop library" already
  (`farm/cultures/views/cultures.py` imports it), which is the correct
  direction; deciding whether it should
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
The wizard always publishes the culture's variety — there is no separate
"general crop or variety" choice in the UI. The dialog calls
`/api/cultures/<id>/publish-public/preview/` only as a background validation
step when the user attempts publication, then shows only actionable problems:

- official `CropSpecies` selected;
- exactly one original language selected (defaulted from the UI language);
- public-library required fields complete (including `variety`, since a
  culture without a variety cannot be published from this dialog); and
- no published public duplicate for the same `CropSpecies` + normalized
  variety.

The species `Autocomplete` offers the proposal inline in the dropdown instead
of as a separate always-visible link: a sentinel option
(`ProposeSpeciesOption` in `CulturesPublishingWizardDialog.tsx`) is appended
by `filterOptions` as the **last** entry whenever the field holds text —
including when official species *do* match. Hiding it behind `noOptionsText`
(the earlier behaviour) meant a partial match such as "Kürbis" matching
"Kürbisgewächse" silently removed the escape hatch, leaving no way to propose
the name the user actually typed. The single exception is an exact
(case-insensitive) hit on an existing name — proposing that can only be
rejected server-side, so the entry disappears. Being a real option rather
than a button in the empty-state slot also makes it keyboard-reachable, and a
divider separates it from the regular hits above it. A failed proposal
surfaces as the field's `error`/`helperText`.

The proposal is **not** sent when that entry is picked. Picking it only puts
the wizard into "propose a new species" mode: the typed name stays in the
field, a hint explains what will happen, and the dialog's main button changes
to "Kulturart vorschlagen". Pressing it files the proposal *and* publishes the
variety under it in one action. Submitting on pick (the earlier behaviour)
meant a user who then closed the wizard left a stray proposal in the
moderation queue for a variety that was never published.

A user does not have to wait for moderation to publish once they've proposed
a species: `resolve_publishing_crop_species()` (`farm.services.public_cultures`)
accepts a `CropSpecies` in either `PUBLISHED` or `PROPOSED` status as a
publish target (`PUBLISHABLE_CROP_SPECIES_STATUSES`) — `REJECTED` species
remain excluded. `PROPOSED` already is the "pending moderation" state
(`CropSpecies.STATUS_PROPOSED`); no separate status was introduced for this.
On the frontend, a successful proposal immediately appends the new species to
the wizard's local options and selects it, so publishing continues right away
instead of staying blocked; a dismissible success `Alert`
(`library.publishWizard.proposedSpeciesNotice`) explains that the variety
will appear provisionally under the not-yet-approved species name. This is
safe because `CropSpeciesViewSet.approve()`/`reject()`
(`backend/crops/views.py`) mutate the same `CropSpecies` row in place — the
id never changes — so once a moderator approves the species, everything
already published under it (including the general entry auto-created below)
keeps working with no relinking; nothing else in the publish path
(`detect_public_culture_duplicates()`, `ensure_general_public_culture()`,
`PublicCultureViewSet`'s list queryset) filters on `crop_species.status` at
all, so this was already the only gate. `CropSpeciesViewSet.get_queryset()`
still hides non-`PUBLISHED` species from every other user/surface (including
the wizard's own initial species list) until a moderator approves or rejects
them, so a pending species is not otherwise discoverable/searchable in the
meantime.

### While a species is `PROPOSED`

Publishing under an unreviewed species is allowed, but everything that treats
the species as *settled reference data* is not. The state is visible and the
three affected actions are blocked on both sides:

- **Visible.** `PublicCultureSerializer.crop_species_status` and
  `CultureSerializer.public_crop_species_pending` expose it. The frontend
  renders "Vorschlag in Prüfung" through one shared `CropSpeciesPendingChip`
  — as a labelled chip in the library detail header and on the proposer's own
  culture, and icon-only (tooltip + `aria-label` carry the text) on the crop
  list row, where the sidebar is 230px wide on `md` and a labelled chip would
  push the crop name out. There the icon takes the slot the "(N)" variety
  count normally occupies instead of trailing it, so pending and non-pending
  rows stay aligned; the count still shows alongside the icon once the
  species has more than one variety (`CropHierarchyRow`'s
  `isPendingSuggestion` prop), so that number isn't lost.
- **Blocked.** Import, the library update/sync, and starting or answering a
  discussion. The UI disables the controls with a tooltip; the backend rejects
  the same three with 409 `crop_species_pending`
  (`PublicCultureViewSet._crop_species_pending_forbidden`), so the disabled
  button is a hint rather than the actual protection. Reading an existing
  discussion stays available.
- **Self-clearing on approve.** `approve()` moves the row out of `PROPOSED`,
  which lifts every block above without any per-object cleanup — the gate
  reads the species' current status, it does not cache a flag.
- **Cleaned up on reject.** `reject()` also moves the row out of `PROPOSED`,
  but a rejected species is never a valid thing to keep publishing under, so
  it goes further: `crops.services.remove_public_cultures_for_rejected_species()`
  runs every `PublicCulture` still `published` under that species through the
  same path as a manual moderator removal
  (`farm.services.public_cultures.remove_public_culture()`, reason
  `species_rejected`) — or, if the acting moderator happens to be the
  entry's own contributor, the self-service withdrawal path instead, since
  `remove_public_culture()` checks contributorship before moderator rights.
  Both are non-destructive and reversible from the moderation queue's
  "removed"/reinstatement flow. This exists because
  `PublicCulture.display_name()` always defers to the linked species' name
  (see below) — without this cleanup, an entry published while a proposal was
  still under review would keep showing the rejected species' name forever.

Either decision also notifies the proposer through
`crops.services.notify_species_proposal_reviewed()` — see
[notifications.md](./notifications.md).

When publishing a variety and the species has no species-level ("general",
empty-`variety`) published entry yet, the backend
(`ensure_general_public_culture()` in `farm.services.public_cultures`)
creates one automatically from the culture's own current values, in the same
transaction as the variety publish. If a general entry already exists for
that species, it is left untouched — publishing a variety never overwrites
another contributor's general data. `publish_as_general=True` remains
supported by the backend (and by `publishPreview`/`publishPublic` in
`api/api.ts`) for backward compatibility, but the wizard no longer sends it.

`build_publishing_check_result()` also returns an optional
`general_crop_notice` (`public_culture_id`, `updated_at`, `is_stale`,
`is_incomplete`) whenever the species' general entry hasn't been updated in
over 24 months (`GENERAL_CROP_STALE_THRESHOLD_DAYS`) or is missing one of the
public-required fields. The wizard shows this as a dismissible info `Alert`
linking to `/app/crop-library?cultureId=<id>` — it never blocks publishing.

Duplicate candidates (`DuplicateCandidate`/`PublicCultureDuplicateCandidate`)
now carry an `is_mine` flag (`created_by_id == user.id`). Since a user's own
matching entry for the same source culture is already resolved as an update
target rather than surfaced as a duplicate, `is_mine: false` is the common
case in the blocking-duplicates list; the wizard renders each duplicate with
a "View entry" link to `/app/crop-library?cultureId=<id>` so a name collision
with someone else's entry points at a concrete place to look, rather than
only naming it in text.

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

When a project culture already points to an owned public entry, the wizard is
an update flow instead of a mapping flow. The owned public culture is shown as
a read-only information block, and the official species plus original language
are taken from that public entry. The user reviews only the field-level
differences before applying them to the existing public version, preventing
accidental relinking to a different public crop from the update dialog.

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
- `restore/` is the inverse of a moderator removal: it puts a `withdrawn` or
  `removed` entry back into `published`. It is the action behind the "removed
  entries" table on `/app/public-library-moderation`, so a wrong removal does
  not need a database fix.
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
