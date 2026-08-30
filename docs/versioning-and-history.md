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

Both restore paths are admin-only (`require_project_admin`) and **single-entity
and non-destructive** — nothing else in the project changes:

- **`GlobalHistoryRestoreView`** restores a *single culture* from one of its
  own past revisions: copies every allowed field from that revision's
  snapshot onto the (possibly soft-deleted — looked up via
  `Culture.all_objects`, not the default manager) culture row, clears
  `deleted_at`, and saves with `_history_action = ACTION_RESTORED`.
- **`ProjectHistoryRestoreView`** does the same generically for *whichever
  entity* the clicked history entry belongs to
  (`restore_entity_from_revision`, `farm/history/restore.py`): looks the
  model up from `entity_type`, and either `UPDATE`s the live row or
  `bulk_create`s it back (bypassing `Model.save()`, so no harvest recalcs or
  auto-revisions) from the snapshot, with the original PK and `deleted_at`
  cleared. A `deleted` revision holds the last state before deletion, so
  restoring it brings the entity back. Then it records an `ACTION_RESTORED`
  `EntityRevision` for that entity.
  - Snapshot fields the model no longer has (renamed/removed in a later
    schema change) are skipped, not fed to the constructor.
  - An FK whose target row is gone is nulled if the field is nullable;
    otherwise, and on any `IntegrityError` (e.g. the recreated row would
    collide with a live one on a unique constraint — a stale snapshot of an
    entity hard-deleted without an `ACTION_DELETED` revision), the view
    returns **422** and changes nothing.
  - It used to restore the *whole project* to the revision's timestamp by
    deleting and rebuilding every restorable entity type. That silently
    emptied projects whose hierarchy (locations/fields/beds) was seeded
    outside the API and so had no revisions to rebuild from — hence the
    switch to single-entity.

## What to check before changing this

- Any entity type that appears in the project history (`_ENTITY_TYPE_LABELS`,
  plus `season`) must be reachable from `_MODEL_BY_ENTITY_TYPE` in
  `restore.py` for its entries to be individually restorable.
- Don't write new rows to `CultureRevision`/`ProjectRevision` — they're
  drain-only.
- Remember `EntityRevision.object_id` is a plain integer, not a real FK —
  there's no DB-level referential-integrity guarantee tying a revision back
  to its live entity table; this is an intentional generic-relation-like
  pattern, not an oversight.

## Entity-type registries

`_RESTORABLE_ENTITY_TYPES` (`backend/farm/history/records.py`) lists the types
whose mutations are recorded via `record_entity_revision`:

`Location` → `Field` → `Bed` → `BedLayout` → `FieldLayout` → `Supplier` →
`Culture` → `PlantingPlan` → `Task` → `NoteAttachment`.

`_ENTITY_TYPE_LABELS` adds three more that also get revision rows —
`MediaFile`, `SeedPackage`, `CultureSupplierData` — and `restore.py` adds
`season`. Any entity type a history entry can carry needs a mapping in
`_MODEL_BY_ENTITY_TYPE` to be individually restorable.

Public crop-library entries have their **own**, separate version history
(`PublicCultureRevision`, see
[crop-library-architecture.md](./crop-library-architecture.md)). They are not
project-scoped and never take part in project restore.
