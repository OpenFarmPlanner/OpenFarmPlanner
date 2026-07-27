/**
 * Pure row-validation helpers used by the editable data grid.
 *
 * These functions derive validation state from rows and the caller-supplied
 * validators without touching grid or component state, which keeps them
 * independently testable and out of the DataGrid component body.
 */

import { GridRowModes } from '@mui/x-data-grid';
import type { GridRowModesModel } from '@mui/x-data-grid';
import type { EditableRow } from './types';

/**
 * Returns true when at least one row currently in edit mode fails validation.
 */
export function hasInvalidRowInEditMode<T extends EditableRow>(
  rowModesModel: GridRowModesModel,
  rowsById: ReadonlyMap<string, T>,
  validateRow: (row: T) => string | null,
): boolean {
  return Object.entries(rowModesModel)
    .filter(([, mode]) => mode.mode === GridRowModes.Edit)
    .some(([rowId]) => {
      const row = rowsById.get(String(rowId));
      if (!row) {
        return false;
      }
      return validateRow(row) !== null;
    });
}

/**
 * Builds a map of per-row field errors, keyed by row id, skipping rows that
 * have no validation errors.
 */
export function collectRowValidationErrors<T extends EditableRow>(
  rows: readonly T[],
  getRowValidationErrors: (row: T) => Record<string, string>,
): Record<string, Record<string, string>> {
  const errorsByRow: Record<string, Record<string, string>> = {};
  for (const row of rows) {
    const errors = getRowValidationErrors(row);
    if (Object.keys(errors).length > 0) {
      errorsByRow[String(row.id)] = errors;
    }
  }
  return errorsByRow;
}
