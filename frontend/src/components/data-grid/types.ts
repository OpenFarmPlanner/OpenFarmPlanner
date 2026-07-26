import type { MutableRefObject, ReactNode } from 'react';
import type { GridColDef, GridColumnVisibilityModel, GridRowId, GridSortModel } from '@mui/x-data-grid';

export interface EditableRow {
  id: number;
  isNew?: boolean;
  __draft?: boolean;
  [key: string]: unknown;
}

export interface DataGridAPI<T> {
  list: () => Promise<{ data: { results: Partial<T>[] } }>;
  create: (data: Partial<T>) => Promise<{ data: T }>;
  update: (id: number, data: Partial<T>) => Promise<{ data: T }>;
  delete: (id: number) => Promise<void>;
}

export interface EditableDataGridCommandApi {
  addRow: () => void;
  editSelectedRow: () => void;
  deleteSelectedRow: () => void;
  deleteRow: (rowId: GridRowId) => void;
  getSelectedRowId: () => GridRowId | null;
  setDraftValues: (rowId: GridRowId, values: Partial<EditableRow>) => Promise<void>;
  commitDraftValues: (rowId: GridRowId, values: Partial<EditableRow>) => Promise<void>;
  reload: () => Promise<void>;
  focusTable: () => void;
  openRowById: (rowId: GridRowId, options?: { startEdit?: boolean }) => void;
}

export interface EditableDataGridRowActionHelpers<T extends EditableRow> {
  startEdit: (rowId: GridRowId, field?: string) => void;
  duplicate: (row: T) => void;
  delete: (rowId: GridRowId) => void;
}

export interface EditableDataGridRowAction<T extends EditableRow> {
  id: string;
  label: string;
  icon?: ReactNode;
  color?: 'default' | 'error' | 'primary';
  onClick: (row: T, helpers: EditableDataGridRowActionHelpers<T>) => void;
  disabled?: boolean;
}

export interface DeleteUndoOptions {
  message: string;
  snackbarTestId?: string;
}

export interface EditableDataGridClipboardColumn<T extends EditableRow> {
  field: string;
  headerName: string;
  getValue?: (row: T) => string;
}

export interface NotesFieldConfig {
  field: string;
  labelKey?: string;
  titleKey?: string;
  attachmentNoteIdField?: string;
  attachmentCountField?: string;
  compactIndicator?: boolean;
}

export interface EditableDataGridProps<T extends EditableRow> {
  columns: GridColDef[];
  api: DataGridAPI<T>;
  createNewRow: () => T;
  mapToRow: (item: T) => T;
  mapToApiData: (row: T) => Partial<T> | Promise<Partial<T>>;
  validateRow: (row: T) => string | null;
  loadErrorMessage: string;
  saveErrorMessage: string;
  deleteErrorMessage: string;
  deleteConfirmMessage: string;
  addButtonLabel: string;
  addButtonText?: string;
  showDeleteAction?: boolean;
  initialRow?: Partial<T>;
  tableKey?: string;
  defaultSortModel?: GridSortModel;
  persistSortInUrl?: boolean;
  notes?: {
    fields: NotesFieldConfig[];
  };
  commandApiRef?: MutableRefObject<EditableDataGridCommandApi | null>;
  onSelectedRowChange?: (row: T | null) => void;
  getRowValidationErrors?: (row: T) => Record<string, string>;
  showAddAction?: boolean;
  showFooterEditControls?: boolean;
  showRowEditActions?: boolean;
  getRowActions?: (row: T, helpers: EditableDataGridRowActionHelpers<T>) => EditableDataGridRowAction<T>[];
  inlineRowActionField?: string;
  getInlineRowActions?: (row: T, helpers: EditableDataGridRowActionHelpers<T>) => EditableDataGridRowAction<T>[];
  showInlineRowActionMenu?: boolean;
  duplicateRow?: (row: T) => T;
  deleteUndoOptions?: DeleteUndoOptions;
  clipboardColumns?: EditableDataGridClipboardColumn<T>[];
  onRowsStateChange?: (rows: T[]) => void;
  onLoadStateChange?: (state: { loading: boolean; dataFetched: boolean; error: string }) => void;
  onBeforeSaveRow?: (row: T) => boolean | Partial<T> | Promise<boolean | Partial<T>>;
  /**
   * Determines whether an unsaved new row can be discarded on blur without
   * running save validation.
   */
  isNewRowEmpty?: (row: T) => boolean;
  isSaveErrorHandled?: (error: unknown) => boolean;
  surfaceSizing?: 'contentFit' | 'fullWorkspace' | 'compact';
  paginationPageSizeOptions?: number[];
  initialPageSize?: number;
  scrollMode?: 'autoHeight' | 'continuous';
  /**
   * Column visibility model. Pass `columnVisibilityModel` from
   * `useColumnVisibility`.
   */
  columnVisibilityModel?: GridColumnVisibilityModel;
  /**
   * Called when the user changes column visibility via a column header's
   * own native "Manage columns" menu. Pass `setColumnVisibilityModel` from
   * `useColumnVisibility`.
   */
  onColumnVisibilityModelChange?: (model: GridColumnVisibilityModel) => void;
}
