/**
 * Common event handlers for MUI DataGrid components.
 * 
 * Provides reusable handlers for consistent behavior across all DataGrid instances.
 * Updated to support spreadsheet-like autosave on blur.
 */

import type { Dispatch, SetStateAction } from 'react';
import { GridRowModes, GridRowEditStopReasons } from '@mui/x-data-grid';
import type { GridEventListener, GridRowModesModel, GridCellParams } from '@mui/x-data-grid';

/**
 * Handler for cell click events that enables edit mode on editable cells.
 * 
 * This handler automatically switches a row to edit mode when a user clicks
 * on an editable cell, focusing the clicked field. This provides Excel-like
 * inline editing behavior.
 * 
 * @param params - The cell click event parameters
 * @param rowModesModel - Current row modes model state
 * @param setRowModesModel - Function to update row modes model state
 */
export function handleEditableCellClick(
  params: GridCellParams,
  rowModesModel: GridRowModesModel,
  setRowModesModel: Dispatch<SetStateAction<GridRowModesModel>>
): void {
  if (!params.isEditable) {
    return;
  }

  const currentMode = rowModesModel[params.id];
  if (
    currentMode?.mode !== GridRowModes.Edit
    || currentMode.fieldToFocus !== params.field
  ) {
    setRowModesModel((oldModel) => ({
      ...oldModel,
      [params.id]: { mode: GridRowModes.Edit, fieldToFocus: params.field },
    }));
  }
}

/**
 * Handler for row edit stop events that enables autosave on blur.
 * 
 * This handler allows the DataGrid to automatically save changes when
 * the row loses focus, implementing spreadsheet-like autosave behavior.
 * However, it prevents exit on rowFocusOut caused by pressing Escape or Tab,
 * allowing those keys to work as expected.
 * 
 * @param params - The row edit stop event parameters
 * @param event - The underlying DOM event
 */
export const handleRowEditStop: GridEventListener<'rowEditStop'> = (params, event): void => {
  // Allow natural blur to trigger save (rowFocusOut)
  // But prevent other unwanted edit stop reasons
  if (params.reason === GridRowEditStopReasons.escapeKeyDown) {
    // Escape should cancel editing without saving
    event.defaultMuiPrevented = true;
  }
  // rowFocusOut will trigger processRowUpdate, implementing autosave on blur
};
