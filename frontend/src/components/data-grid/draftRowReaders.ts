/**
 * Deterministic readers that reconstruct the current draft state of a grid row.
 *
 * These helpers only read from the grid API and the rendered DOM; they never
 * mutate grid or component state. Keeping them free of React state makes the
 * draft-resolution logic independently testable and shrinks the DataGrid
 * component module.
 */

import type { GridApi, GridColDef, GridRowId } from '@mui/x-data-grid';
import { cssEscape } from './continuousScrollLayout';
import { parseGermanDateText } from './GermanDateEditCell';
import type { EditableRow } from './types';

/**
 * Layers any in-flight edit-cell values from the grid API on top of a base row.
 * Returns a new row object without touching the grid or component state.
 */
export function readDraftRow<T extends EditableRow>(
  api: GridApi,
  columns: readonly GridColDef[],
  baseRow: T,
  rowId: GridRowId,
): T {
  const draftRow = { ...baseRow } as Record<string, unknown>;
  for (const column of columns) {
    const rowWithUpdatedField = api.getRowWithUpdatedValues(rowId, column.field) as
      | Record<string, unknown>
      | null;
    if (
      rowWithUpdatedField &&
      Object.prototype.hasOwnProperty.call(rowWithUpdatedField, column.field)
    ) {
      draftRow[column.field] = rowWithUpdatedField[column.field];
    }
  }
  return draftRow as T;
}

/**
 * Reads the raw text of currently-open date edit inputs straight from the DOM
 * and merges the parsed values into the draft row. This captures keystrokes
 * that have not yet been committed to the grid's edit state.
 */
export function mergeVisibleDateEditInputValues<T extends EditableRow>(
  root: HTMLElement | null,
  columns: readonly GridColDef[],
  rowId: GridRowId,
  draftRow: T,
): T {
  if (!root) {
    return draftRow;
  }

  const rowElement = root.querySelector<HTMLElement>(
    `[role="row"][data-id="${cssEscape(String(rowId))}"]`,
  );
  if (!rowElement) {
    return draftRow;
  }

  const nextDraft = { ...draftRow } as Record<string, unknown>;
  for (const column of columns) {
    if (column.type !== 'date') {
      continue;
    }

    const cellElement = rowElement.querySelector<HTMLElement>(
      `[data-field="${cssEscape(column.field)}"].MuiDataGrid-cell--editing`,
    );
    const inputElement = cellElement?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      'input:not([type="hidden"]):not([aria-hidden="true"]), textarea',
    );
    const inputValue = inputElement?.value;
    if (inputValue === undefined) {
      continue;
    }

    nextDraft[column.field] = parseGermanDateText(inputValue) ?? inputValue;
  }
  return nextDraft as T;
}
