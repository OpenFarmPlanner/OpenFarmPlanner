# DataGrid Architecture

OpenFarmPlanner builds most editable tables on `EditableDataGrid`
(`frontend/src/components/data-grid/DataGrid.tsx`), a wrapper around MUI X
`<DataGrid>`. This doc covers what OpenFarmPlanner *added* on top of the
stock grid. It intentionally does not repeat:

- keyboard focus regions and the global shortcut system —
  [keyboard-architecture.md](./keyboard-architecture.md)
- autosave-on-blur mechanics — `AUTOSAVE_IMPLEMENTATION.md`
- the Standort/Parzelle/Beet tree view (a *different*, raw `<DataGrid>`
  page, not `EditableDataGrid`) — [occupancy-tree-hierarchy.md](./occupancy-tree-hierarchy.md)

**Not every table uses `EditableDataGrid`.** `FieldsBedsHierarchy.tsx`
renders a raw MUI `<DataGrid>` with its own row-data wiring and keyboard
navigation (`useHierarchyContextMenu.ts`). It shares the generic context
menu state/shell pieces with `EditableDataGrid`, but still has separate
trigger conditions and hierarchy-specific actions — when you change one,
check whether the other needs the same fix, but don't assume every layer is
shared.

## File map

```text
frontend/src/components/data-grid/
  DataGrid.tsx            EditableDataGrid<T> — the main wrapper component
  index.ts                Public barrel export
  hooks/
    useDataGridCommandApi.ts     builds the imperative EditableDataGridCommandApi
    useDataGridRowCommands.ts    addRow/editSelectedRow/openRowById/focusTable
    useDataGridDelete.ts         immediate delete + optional undo-snackbar flow
    useDataGridRowActionMenu.ts  right-click / long-press / keyboard row menu
  StableScrollbarTrack.tsx       shared track/thumb overlay for useStableDataGridScrollbar
  keyboardEditing.ts       "just start typing" / F2 spreadsheet-edit-start behavior
  keyboardNavigation.ts    Tab/Arrow cell navigation rules, grid-API-agnostic
  contextMenuFocus.ts      Arrow/Home/End/Enter/Esc navigation *inside* an open menu
  AreaM2EditCell.tsx, DateEditCell.tsx, PlantsCountEditCell.tsx,
  SearchableSelectEditCell.tsx                            custom edit cells
  FullCellTooltip.tsx     full-cell hover/focus target for unavailable values
  GermanDateEditCell.tsx   shared German date parse/format helpers only
                           (its edit-cell component was removed as dead code)
  NotesCell.tsx, NotesDrawer.tsx, NotesPreviewPopover.tsx,
  useNotesEditor.ts, useNotesPreview.ts, markdown.ts,
  noteAttachmentsCache.ts               rich markdown notes + photo attachments
  ../OverflowTooltip.tsx                overflow-only desktop tooltip wrapper
  tableClipboard.ts, TableCopyMenuItems.tsx   copy row/table as TSV
  columns.tsx, calculatedColumns.tsx    column builders (select, computed)
  dataGridUtils.tsx, handlers.ts, styles.ts, localeText.ts   shared helpers

frontend/src/components/contextMenu/
  CustomContextMenu.tsx          shared MUI Menu shell for app context menus
  useContextMenuPositionState.ts generic open/close/reposition state
  useRowContextMenuState.ts      row-menu state plus focus restoration
  useLongPressTimer.ts           touch long-press helper
```

## Imperative API (`EditableDataGridCommandApi`)

A page passes a `commandApiRef` into `EditableDataGrid`; the grid populates
it on mount (`hooks/useDataGridCommandApi.ts`):

```ts
interface EditableDataGridCommandApi {
  addRow, editSelectedRow, deleteSelectedRow, deleteRow(rowId),
  getSelectedRowId, setDraftValues(rowId, values), commitDraftValues(rowId, values),
  applyDialogEditValues(rowId, values),
  reload, focusTable, openRowById(rowId, { startEdit? }),
}
```

`openRowById(rowId, { startEdit })` is the deep-link entry point: it scrolls
to and selects a row, optionally opening edit mode. Today only
`PlantingPlans.tsx` uses it — the Gantt calendar's context menu
("Anbauplan öffnen" / "bearbeiten") navigates to
`/app/planting-plans?planId=<id>&edit=true`, and `PlantingPlans.tsx` resolves
that param to `openRowById(planId, { startEdit: true })`. This deliberately
replaced an earlier `initialRow`-based approach, which always prefilled a
**new draft row** — clicking "open" on an existing task used to silently
create a duplicate-looking blank plan instead of opening the one clicked.
If you add deep-linking into another grid page, this is the reference
pattern to follow, not a one-off to reinvent.

For large editable flat tables, `EditableDataGrid` also supports
`scrollMode="continuous"`. This keeps the free MUI DataGrid's internal page
size at 100 rows, hides the pager UI, and advances the internal row window
from wheel/touch scrolling so the table behaves like a continuous virtualized
scroll area. The full row array remains in component state, so sorting,
filtering, copy operations, and page-level mobile mirrors still operate on
the complete loaded dataset.

Continuous scroll uses `hooks/useScrollDrivenRowWindow.ts` for the internal
100-row window and `hooks/useStableDataGridScrollbar.ts` for the visible
thumb. The same stable-scrollbar hook is re-exported for the raw
Standort/Parzelle/Beet hierarchy so both large table styles keep matching
scrollbar behavior without parallel implementations; both also render the
track/thumb overlay itself through the shared `StableScrollbarTrack.tsx`
rather than each page hand-rolling the same absolutely-positioned Boxes.

`StableScrollbarTrack` must be rendered as a sibling of whatever wrapper Box
scrolls the table horizontally, not nested inside it — its `right: 0` is
relative to the nearest positioned ancestor, so nesting it inside content
that can be wider than the visible viewport (e.g. `surfaceSizing="contentFit"`)
pins it to the *content's* right edge instead of the *viewport's*, letting it
scroll out of view as the user scrolls the table horizontally.

`setDraftValues`/`commitDraftValues` let external code push field values
into a row that's already mid-edit (e.g. a calculated side-effect from
another field), either staying in edit mode or committing immediately.
`applyDialogEditValues` is the entry point for cells that have no edit
session at all — see "Cells edited in a popover/dialog" below.

## Custom edit cells

MUI's stock edit cells didn't fit a few OpenFarmPlanner-specific needs:

- **`AreaM2EditCell` / `PlantsCountEditCell`** — both preserve the raw text
  the user is typing (including a mid-typed decimal separator or a
  temporarily invalid/partial value) instead of coercing on every
  keystroke like MUI's built-in number editor does; normalization happens
  at save time, not on each keypress.
- **`DateEditCell`** (the default for any `type: 'date'` column, applied
  automatically by `dataGridUtils.tsx`'s `applyDefaultDateEditCell`) — a
  from-scratch segmented `TT.MM.JJJJ` editor: per-segment cursor tracking,
  Up/Down arrows increment/decrement the active day/month/year segment
  (with correct month-length/rollover handling), Left/Right move between
  segments, plus a hidden native `<input type="date">` behind a calendar
  icon as a picker fallback.
- **`GermanDateEditCell.tsx`** no longer exports an edit-cell component —
  the component itself was confirmed unused as a `renderEditCell` anywhere
  and removed. The file now only holds the shared
  `parseGermanDateText`/`formatDateAsGerman` helpers that `DateEditCell`
  imports.
- **`SearchableSelectEditCell`** wraps an MUI Autocomplete for single-select
  columns with large option lists (cultures, suppliers) that a plain
  `singleSelect` dropdown wouldn't make browsable; `columns.tsx` also
  exposes a `createSingleSelectColumn` builder (plain dropdown) for
  short option lists — pick whichever builder matches the option-list size,
  don't default to the searchable one everywhere. The plain editor renders
  through `StandardSingleSelectEditCell`, which reuses the shared closed
  Select typeahead hook from `components/inputs/selectTypeahead.ts` so typing
  on a focused closed editor selects by the localized visible label just like
  form-level Selects.

## Keyboard editing/navigation inside the grid

`docs/keyboard-architecture.md` still lists "applying the region-shortcut
pattern to DataGrid" as future work for the *page-level* keyboard model —
that's still true. But cell-level Tab/Arrow/Enter/F2 navigation
(`keyboardEditing.ts` + `keyboardNavigation.ts`) is fully implemented:

- **`keyboardNavigation.ts`** — pure helpers (grid-API-agnostic, easy to
  unit test) for stepping Tab/Shift+Tab/Left/Right across visible, editable
  columns, and Up/Down across rows — falling back to the nearest navigable
  cell in the target row if the same column isn't editable there (so Enter
  after editing one column doesn't get stuck on a read-only next-row cell).
  When navigation lands inside a row that is already in edit mode, the shared
  focus helper focuses the target cell's actual editor input instead of only
  the DataGrid cell wrapper; otherwise the cell can look focused while
  printable keystrokes are ignored.
- While a row is in edit mode, `EditableDataGrid` owns Tab/Shift+Tab
  navigation even when focus is inside a custom editor input. MUI's own
  native capture handlers can otherwise move to the next row before React
  editor handlers run, so the wrapper uses one grid-scoped capture listener
  that only handles Tab events originating inside the edited grid surface and
  then routes them through the same pure navigation helpers.
- **`keyboardEditing.ts`**'s `useSpreadsheetEditStarter` implements
  Excel-like "just start typing" (a printable keydown on a non-editing
  cell immediately opens edit mode and *replaces* the cell's value with the
  typed character, buffering rapid keystrokes typed before the edit-cell
  component has actually mounted) and F2 (opens edit mode *without*
  altering the value — the standard spreadsheet distinction between the
  two). The same starter also handles the row-edit edge case where Tab or
  Shift+Tab has visibly focused another editable cell but DOM focus is still
  on the cell container rather than the mounted editor input: the first
  printable key is still captured, buffered, and written into that target
  cell instead of being lost. If the editor input itself already owns DOM
  focus, its native input event is left untouched; restarting row edit mode
  there would discard other unsynchronized values in a newly created row. The
  hierarchy's name and dimension editors disable MUI's default input debounce
  because row-level validation across rapidly edited fields can otherwise
  complete out of order and restore an older value after a focus change.
- Notes cells and `dialogEditFields` cells (both below) are deliberately
  excluded from spreadsheet auto-edit-start, the F2 flow, and click-to-edit —
  Enter/Space opens their own editor instead. They remain Tab/arrow stops via
  the `isActionCell` hook, since `editable: false` alone would skip them.

## Hover actions / row actions / context menu

Triggers: right-click, the `ContextMenu` keyboard key / `Shift+F10`, and a
550ms touch long-press (with a `.ofp-row-long-press` visual affordance
during the hold). All three funnel into the same
`hooks/useDataGridRowActionMenu.ts` state machine, positioned either at the
mouse coordinates or the focused cell's bounding rect. Menu contents:
caller-supplied row actions (duplicate/delete by default) plus
"copy row"/"copy table" (see below). Closing the menu restores keyboard
focus to whatever opened it.

Use `components/contextMenu/CustomContextMenu.tsx` for the rendered menu
shell instead of repeating MUI's `hideBackdrop`, pointer-events, paper class,
`anchorReference`, and optional list-focus props in each page. Use
`useContextMenuPositionState.ts` for positioned chart-style menus, and
`useRowContextMenuState.ts` when the menu should restore focus to the row or
cell that opened it.

A first-run **discovery hint** (`ContextMenuHint.tsx` /
`useContextMenuHint.ts`) shows a small "right-click a row" banner once,
only on fine-pointer desktop viewports, persisted per-user in
`localStorage` and synced across tabs — this is UX polish, not
functionality; don't remove the dismissal persistence when touching it.

Separately, `renderInlineActionCell` overlays icon buttons directly inside
one cell on row hover — this is the "hover actions" surface distinct from
the right-click menu.

**`FieldsBedsHierarchy.tsx`'s `useHierarchyContextMenu.ts` is a separate
implementation of the same right-click/long-press pattern**, because that
page uses a raw `<DataGrid>`, not `EditableDataGrid`, and needs different
data shapes (three row types/APIs, whole-row-object state) that
`EditableDataGrid` has no concept of. It shares its open/close/reposition
state machine, focus restoration, menu shell, and long-press timer with
`useDataGridRowActionMenu.ts` via small, tree-agnostic helpers
(`components/contextMenu/useRowContextMenuState.ts`,
`CustomContextMenu.tsx`, `useLongPressTimer.ts`), but the trigger conditions
and row-data wiring around that shared core are deliberately separate —
treat a UX fix to
*when/how* the menu opens (or the row-type-specific actions inside it) as
*not* automatically fixing the other; only a fix to the shared
open/close/reposition/focus-restore mechanics itself applies to both.

The hierarchy grid also coordinates its notes drawer with row editing
directly: saving notes for a new or still-editing Standort/Parzelle/Beet row
first persists the current row draft with the note value, then closes the
drawer. Users should never need to click outside the grid to make a new row
exist before saving its notes.

## Delete with undo — app-wide semantics

Every "Löschen" flow that shows a `DeleteUndoSnackbar` follows the same
contract, and new ones must too:

1. **The delete hits the backend immediately.** The row disappears from the
   list optimistically, but the DELETE request is sent in the same user
   action — it is never deferred until the undo window has elapsed. A browser
   reload right after deleting must never bring the record back.
2. **"Rückgängig" restores, it never cancels.** By the time the snackbar is
   visible the record is already gone server-side, so undo means calling a
   restore/recreate endpoint.
3. **A failed DELETE rolls the row back** into the list and reports the error;
   no snackbar is shown, because there is nothing to undo.
4. **Dismissing the snackbar does nothing** but drop the pending entry — it is
   not a commit point.

Where this lives:

| Entity | Delete | Undo |
| --- | --- | --- |
| Anbaupläne (`useDataGridDelete.ts`, `deleteUndoOptions`) | `api.delete` | `api.create(mapToApiData(row))` + reload |
| Kulturen (`pages/useCultureDelete.ts`) | `cultureAPI.delete` (soft delete) | `cultureAPI.undelete` |
| Standorte/Parzellen/Beete (`hooks/useHierarchyDelete.ts`) | `locationAPI`/`fieldAPI`/`bedAPI.delete` | recreate location → field → bed, remapping parent ids |
| Lieferanten (`pages/Suppliers.tsx`) | `supplierAPI.delete` (409 when still referenced) | `supplierAPI.restoreUnlinkedDelete` with the payload the delete/unlink response returned |
| Projekte (`projects/projectDeletionFeedback.ts`) | `projectAPI.delete` (soft delete) | `projectAPI.restore` |

Entities that are recreated rather than undeleted come back with a **new id**
— the grid reloads from the backend after a restore instead of re-inserting
the old row, so sorting decides the position, not the previous id.

The supplier delete endpoint returns the same `undo_payload` shape as
`unlink-and-delete` (instead of an empty `204`) so that both supplier delete
paths share one restore endpoint.

## Notes / markdown cells

Any column listed in `EditableDataGrid`'s `notes` prop renders through
`NotesCell.tsx` instead of a normal edit cell: an icon, a plain-text
excerpt, and (unless `compactIndicator`) a hover/focus/touch-triggered
preview popover (`NotesPreviewPopover.tsx` — one shared popover instance
per grid, not one per row, opened after a 250ms hover delay). Notes are
*not* edited inline — clicking opens `NotesDrawer.tsx`, a full markdown
editor (Edit/Preview tabs, a formatting toolbar) that additionally supports
photo attachments when the column has an `attachmentNoteIdField`: capture
or pick a photo, crop it with a hand-rolled pointer-drag crop tool, and
downscale/re-encode to WebP (falling back to JPEG) client-side before
upload. `noteAttachmentsCache.ts` caches attachment fetches per note id so
re-hovering a row doesn't refetch; the drawer explicitly invalidates that
cache after upload/delete.

## Cells edited in a popover/dialog (`dialogEditFields`)

Some values are never typed into a cell — they are picked in a dialog
(today: the Anbaupläne "Anbaufläche" column, a Standort → Parzelle → Beet
picker in `AreaAssignmentDialog.tsx`). Those columns are **`editable:
false`** and listed in `EditableDataGrid`'s `dialogEditFields` prop. The
grid then treats them exactly like notes cells:

- **one left click opens the real editor.** The column's `renderCell` —
  not `renderEditCell` — renders both the value and the dialog, so the
  click lands directly on the dialog trigger. There is deliberately no
  intermediate inline edit state and no pencil icon: an edit mode the user
  can only click *through* is a wasted click, not an affordance.
- **no inline edit mode is ever started for them**, from the click, from
  F2, or from "just start typing" (`onCellClick` returns early and
  `useSpreadsheetEditStarter` gets an `isCellEditable` that rejects them).
- **they stay keyboard stops.** `editable: false` would normally drop a
  cell out of Tab/arrow navigation, so `isCellKeyboardNavigable`'s
  `isActionCell` hook covers notes *and* dialog fields
  (`dedicatedEditorFieldNames` in `DataGrid.tsx`). Enter/Space is handled by
  the trigger element itself, which stops propagation so the grid does not
  also react; after the dialog closes, focus returns to that trigger and
  ordinary navigation continues.

The dialog writes its result back through the command API's
`applyDialogEditValues(rowId, values)`, **not** `setEditCellValue` (there is
no edit session to write into) and **not** a column `valueSetter` (which
only runs in edit mode — any side effects it had must move into the caller;
see `applyBedSelection` in `PlantingPlans.tsx`). It branches on the row's
current mode: a row already in inline edit mode — typically a new draft row
— only gets the values merged into its draft, so its own save cycle
persists everything at once; a row in view mode is saved immediately
through the normal `processRowUpdate` path, including the
`onBeforeSaveRow` gate.

`FieldsBedsHierarchy.tsx` needs no equivalent: its only
non-inline-edited column is `notes`, whose cell already opens the drawer on
a single click.

## Text overflow tooltips

Plain text headers and cells should not use tooltips that simply repeat
visible content. Shared table code uses `OverflowTooltip` for this: it
measures the hovered/focused element only on fine-pointer desktop
interaction (and while the active element resizes) and shows the full text
only when the element actually overflows. This keeps desktop truncation
recoverable without adding hover-equivalent popovers or tap targets on
mobile/touch surfaces. Explanatory tooltips remain separate: icon labels,
calculated-column explanations, unavailable-value reasons, note previews,
and package/blocker diagnostics should still use their dedicated tooltip or
popover components.

`markdown.ts`'s `stripCitationMarkers` strips AI-citation markers of the
form `【digits†identifier】` from note text. **Unclear/needs check**: trace
where such markers actually get inserted (an LLM-assisted import/enrichment
path elsewhere in the app, presumably) before documenting the "why" further
— it wasn't found in the files reviewed for this doc.

## Copy/paste

Copy-only today (no paste-in). `tableClipboard.ts` formats selected rows as
tab/newline-delimited text (dates localized `de-DE`, arrays joined with
`, `); `TableCopyMenuItems.tsx` adds "Copy row" (header + the right-clicked
row) and "Copy table" (header + every currently loaded/filtered/sorted row)
to the row-action menu — both paste directly into Excel/Sheets.

## Column visibility

Column show/hide is handled entirely by **MUI's native columns panel**
today. A custom show/hide menu and a separate ResizeObserver-driven
"autofit" responsive-hiding feature both existed earlier and were
deliberately removed in favor of it (see the git history around
`Replace custom column show/hide menu with MUI's native columns panel` and
`Fold responsive column hiding into the native visibility model`) — do not
reintroduce a bespoke visibility UI. `EditableDataGrid` only passes
`columnVisibilityModel`/`onColumnVisibilityModelChange` straight through to
the underlying MUI grid; the actual state lives in the page via
`useColumnVisibility(...)` (`frontend/src/hooks/useColumnVisibility.ts`),
which persists to `localStorage` under `tableColumns.<tableKey>` and
supports a `defaultHiddenFieldsOnSmallScreen` list that only applies until
the user makes their *first* explicit visibility choice — after that, the
user's choice always wins regardless of screen size.

`FieldsBedsHierarchy.tsx` (raw `<DataGrid>`) has **no column-visibility
feature at all** today — this was an explicit scope cut when the feature
was migrated to the native panel elsewhere, not an oversight to "fix" as a
drive-by change.

## Row history / versioning — not a grid feature

Culture version history (backed by the generic `EntityRevision` model, see
[versioning-and-history.md](./versioning-and-history.md)) is shown in a
**standalone MUI `Dialog`** on `Cultures.tsx`, populated via
`cultureAPI.history(...)`. It does not surface inside any grid cell,
row-action menu, or notes drawer — if you're asked to "show history in the
grid," that's new work, not exposing something that already half-exists.

## Cross-cutting utilities

- `dataGridUtils.tsx` — `isUnsavedDraftRow` (heuristic for local-only,
  not-yet-saved rows), `SaveBlockedError` (lets `onBeforeSaveRow` silently
  keep a row in edit mode without surfacing an error), `prepareDataGridColumn`
  (applies the default date edit cell and makes unsaved draft rows immune
  to active column filters), `getSortedRowIds`/`orderRowsByStableIds`
  (rows are kept in a stable client-side order rather than trusting the
  grid's own post-edit row order). `DataGrid.tsx`'s `stableRowOrder` state is
  only refreshed via `refreshStableRowOrder` on data fetch, an explicit sort
  change, or a filter change — never as a side effect of a row being
  created/saved — which is what stops a create/rename in a sorted table from
  immediately jumping the row to its freshly-sorted position.
  `FieldsBedsHierarchy.tsx` (see below) is not `EditableDataGrid` and doesn't
  share this state, but `hierarchyUtils.ts`'s `computeHierarchyOrderSnapshot`/
  `applyHierarchyOrderSnapshot` implement the same pattern independently for
  its raw `<DataGrid>`, refreshed via `useHierarchyData`'s `fetchGeneration`
  (foreground fetches only) and an explicit sort-model-change handler.
  Entities absent from the snapshot (new/unsaved rows) are placed *first*
  within their entity list rather than appended last — once grouped by
  parent, that puts a newly created Standort/Parzelle/Beet as the first
  child right next to the "add" action that created it, instead of
  potentially many screens below the bottom of a long group.
  `FieldsBedsPage.tsx`'s "Standort hinzufügen" flow follows the same
  principle: it merges the created location into state directly
  (`setLocations` prepend) instead of triggering a full `fetchData()`
  reload, which would otherwise immediately re-sort the table and could
  place the new location far from the topbar action that created it.
- `handlers.ts` — `handleRowEditStop` deliberately suppresses MUI's default
  Escape-triggers-save-attempt behavior so Escape reliably means "cancel";
  see `AUTOSAVE_IMPLEMENTATION.md` for how the blur-triggered save itself
  works.
- `styles.ts` — the single `dataGridSx` object defining every `ofp-*` CSS
  class referenced above (`.ofp-row-editing`, `.ofp-cell-dirty`,
  `.ofp-cell-error`, `.ofp-row-long-press`, ...). Cells that render
  `FullCellTooltip` must also use `FULL_CELL_TOOLTIP_CELL_CLASS` so its
  absolute trigger covers the cell and follows the grid's keyboard focus.
  DataGrid renderers pass `cellHasFocus`; plain read-only table cells can use
  `focusable` when the tooltip trigger itself needs a keyboard stop. Do not
  use `focusable` inside DataGrid cells or around an already focusable link.

## What to check before changing this layer

- If you change *when/how* the row-action menu opens or keyboard-navigation
  behavior, check whether `FieldsBedsHierarchy.tsx`'s implementation needs
  the same change (see above) — only the shared
  `useRowContextMenuState`/`useLongPressTimer` mechanics are common; a fix
  to trigger conditions or row-type wiring in one does not apply to the
  other automatically.
- Keep new edit cells consistent with the "preserve raw input text, defer
  normalization to save time" pattern used by the existing custom edit
  cells, rather than coercing on every keystroke.
- Don't reintroduce a custom column-visibility UI; extend
  `useColumnVisibility`/the native panel instead.
- Notes columns must stay `editable: false` and excluded from the
  spreadsheet auto-edit-start/F2 flow — they have their own editor.
- A new column whose value is only ever picked in a popover/dialog belongs
  in `dialogEditFields`, not in a `renderEditCell`. Don't reintroduce a
  cell-level edit mode whose only purpose is to reveal a button that opens
  the real editor — that costs the user a click for nothing.
