import { useEffect } from 'react';
import { GridRowModes } from '@mui/x-data-grid';
import type { GridRowId, GridRowModesModel } from '@mui/x-data-grid';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { EditableDataGridCommandApi, EditableRow } from '../types';

interface UseDataGridCommandApiParams<T extends EditableRow> {
  commandApiRef?: MutableRefObject<EditableDataGridCommandApi | null>;
  selectedRowIds: GridRowId[];
  deleteRowCommandRef: MutableRefObject<(rowId: GridRowId) => void>;
  handleAddClick: () => void;
  handleEditSelectedRow: () => void;
  handleDeleteSelectedRow: () => void;
  setRowModesModel: Dispatch<SetStateAction<GridRowModesModel>>;
  applyDraftValues: (rowId: GridRowId, values: Partial<T>) => Promise<void>;
  commitDraftValues: (rowId: GridRowId, values: Partial<T>) => Promise<void>;
  applyDialogEditValues: (rowId: GridRowId, values: Partial<T>) => Promise<void>;
  reload: () => Promise<void>;
  focusTable: () => void;
  openRowById: (rowId: GridRowId, options?: { startEdit?: boolean }) => void;
}

export function useDataGridCommandApi<T extends EditableRow>({
  commandApiRef,
  selectedRowIds,
  deleteRowCommandRef,
  handleAddClick,
  handleEditSelectedRow,
  handleDeleteSelectedRow,
  setRowModesModel,
  applyDraftValues,
  commitDraftValues,
  applyDialogEditValues,
  reload,
  focusTable,
  openRowById,
}: UseDataGridCommandApiParams<T>): void {
  useEffect(() => {
    if (!commandApiRef) {
      return;
    }

    commandApiRef.current = {
      addRow: handleAddClick,
      editSelectedRow: handleEditSelectedRow,
      deleteSelectedRow: handleDeleteSelectedRow,
      deleteRow: (rowId) => deleteRowCommandRef.current(rowId),
      getSelectedRowId: () => selectedRowIds[0] ?? null,
      setDraftValues: async (rowId, values) => {
        await applyDraftValues(rowId, values as Partial<T>);
        setRowModesModel((previousModel) => ({
          ...previousModel,
          [rowId]: {
            ...(previousModel[rowId] ?? {}),
            mode: GridRowModes.Edit,
          },
        }));
      },
      commitDraftValues: async (rowId, values) => {
        await commitDraftValues(rowId, values as Partial<T>);
      },
      applyDialogEditValues: async (rowId, values) => {
        await applyDialogEditValues(rowId, values as Partial<T>);
      },
      reload,
      focusTable,
      openRowById,
    };

    return () => {
      commandApiRef.current = null;
    };
  }, [
    applyDialogEditValues,
    applyDraftValues,
    commandApiRef,
    commitDraftValues,
    deleteRowCommandRef,
    focusTable,
    handleAddClick,
    handleDeleteSelectedRow,
    handleEditSelectedRow,
    openRowById,
    reload,
    selectedRowIds,
    setRowModesModel,
  ]);
}
