# Versioning and History (`EntityRevision`)

OpenFarmPlanner keeps an audit trail and supports restoring cultures and
whole projects to a past point in time. This is **snapshot-based**, not
event-sourced: each history row is a full point-in-time copy of one
entity's fields, not a delta to replay.

## The model

`EntityRevision` (`backend/farm/models/history.py`) is the current, generic
mechanism: one row per `(entity_type, object_id)` per mutation
(`created` / `updated` / `deleted` / `restored`), holding a full JSON
`snapshot` of the entity's fields at that moment plus a `changed_fields`
list for diff display. It replaced two now-deprecated models:

- `CultureRevision` — the original culture-only history table.
- `ProjectRevision` — snapshotted the *entire project* as one JSON blob per
  mutation, which didn't scale as projects grew.

Both are retained only so existing rows can drain via the `cleanup_history`
management command — **no new rows are written to either**. If you're
adding history for a new entity type, extend `EntityRevision`, not the old
models.

Why per-entity instead of per-project: write cost now scales with the size
of the single changed entity, not with the size of the whole project, since
every mutation only writes one small `EntityRevision` row rather than
re-serializing everything the project contains.

## Writing revisions

`record_entity_revision(...)` (`backend/farm/history/records.py`) is the single
write path — it just creates an `EntityRevision` row. It's called:

- **Automatically** inside `Culture.save()` on every create/update, so
  culture history requires no explicit call from view code.
- **Explicitly** from view code for other mutation paths (soft-delete,
  restore, project-level restore) — look for `culture._history_action = ...`
  assignments before `.save()` calls in the farm domain view packages; this is
  how a save is tagged as a delete/restore action rather than a plain
  update for history purposes.

## Reading history

- `GlobalHistoryListView` (`GET`, culture-only) and `ProjectHistoryListView`
  (`GET`, all entity types) return the last 30 days of revisions for the
  active project. `GlobalHistoryListView` additionally computes a
  human-readable diff (`_build_entity_revision_changes`) between each
  revision's snapshot and the *previous* revision for the same object,
  skipping internal/denormalized fields (`id`, timestamps, `project_id`,
  `*_normalized` fields, ...).
- On the frontend this surfaces as the per-culture/global history **dialog**
  on `Cultures.tsx` (see
  [datagrid-architecture.md](./datagrid-architecture.md#row-history--versioning--not-a-grid-feature))
  and as the project version-history dialog
  (`frontend/src/navigation/ProjectHistoryDialog.tsx`, opened from the global
  menu / command palette).

## Batch operations (grouping a cascade)

A single user action can cascade into many entity mutations — deleting a
season also deletes every planting plan in it. `BatchOperation`
(`backend/farm/models/history.py`) groups the resulting revisions so the
history shows them as one collapsible entry instead of a dozen unrelated
"planting plan deleted" rows.

- `start_batch_operation(project=, operation_type=, context=, user_name=)`
  (`backend/farm/history/records.py`) creates the group; pass the returned
  instance as `batch_operation=` to every `record_entity_revision` /
  `record_revision` call the action makes. `context` is free-form JSON the
  frontend uses to phrase the summary (e.g. `{"season_label": "25/26"}`).
- `EntityRevision.batch_operation` is a nullable `SET_NULL` FK — ordinary
  single-entity edits leave it NULL and render flat as before. The
  individual revisions stay in the DB and stay individually restorable; the
  batch is only a display grouping.
- Wired today in `SeasonViewSet` (`season_delete`, `season_undelete`,
  `season_copy_data`). Reuse the same helper for any future cascade
  (season-pattern application, crop-rotation batch edits) — no schema change
  needed, just a new `operation_type` constant and a frontend label.
- `ProjectHistoryListView` folds revisions sharing a `batch_operation` into
  one `is_batch` entry carrying the individual entries in `children`; the
  frontend (`isBatchGroupEntry` / `getBatchSummary` in
  `frontend/src/pages/culturesHistoryUtils.ts`) renders a group only when
  `children.length >= 2`, otherwise the lone child renders as a plain row.
- `cleanup_history` drops `BatchOperation` rows older than the cutoff once
  all their revisions have been pruned.

## Restoring

Two restore paths, both admin-only (`require_project_admin`):

- **`GlobalHistoryRestoreView`** restores a *single culture* from one of its
  own past revisions: copies every allowed field from that revision's
  snapshot onto the (possibly soft-deleted — looked up via
  `Culture.all_objects`, not the default manager) culture row, clears
  `deleted_at`, and saves with `_history_action = ACTION_RESTORED`.
- **`ProjectHistoryRestoreView`** restores the *whole project* to a target
  timestamp (`_restore_project_state_at`): for every restorable entity
  type, it deletes all current rows of that type in the project and
  bulk-recreates them from `_entity_states_at(project, entity_type,
  target_time)` — which, for each `object_id`, takes the most recent
  revision at or before `target_time` (a `None` snapshot, i.e. the entity
  was deleted by then, means it's simply not recreated). Entity types are
  deleted in **reverse** dependency order before being recreated in forward
  order, to avoid FK constraint errors during the rebuild.
  `_restore_project_state_at` tolerates schema drift: a snapshot may carry
  fields the current model no longer has (from before a field was renamed
  or removed), and those are silently dropped rather than raising.

## What to check before changing this

- If you add a new project-scoped model that should participate in
  project-wide point-in-time restore, add it to the restorable-entity-type
  list used by `_restore_project_state_at` and make sure something calls
  `record_entity_revision` for it — being project-scoped alone does not
  give a model history for free.
- Don't write new rows to `CultureRevision`/`ProjectRevision` — they're
  drain-only.
- Remember `EntityRevision.object_id` is a plain integer, not a real FK —
  there's no DB-level referential-integrity guarantee tying a revision back
  to its live entity table; this is an intentional generic-relation-like
  pattern, not an oversight.

## What participates in whole-project restore

`_RESTORABLE_ENTITY_TYPES` (`backend/farm/history/records.py`) is an ordered
list — parents before children, because restore deletes in reverse order and
recreates in forward order:

`Location` → `Field` → `Bed` → `BedLayout` → `FieldLayout` → `Supplier` →
`Culture` → `PlantingPlan` → `Task` → `NoteAttachment`.

Three more entity types get revision rows but are **not** part of
whole-project restore (they are in `_ENTITY_TYPE_LABELS` only):
`MediaFile`, `SeedPackage`, and `CultureSupplierData`. That mirrors what the
older whole-project serializer already omitted. Read the list in the source
before relying on it — this is the kind of thing a new model silently misses.

Public crop-library entries have their **own**, separate version history
(`PublicCultureRevision`, see
[crop-library-architecture.md](./crop-library-architecture.md)). They are not
project-scoped and never take part in project restore.
