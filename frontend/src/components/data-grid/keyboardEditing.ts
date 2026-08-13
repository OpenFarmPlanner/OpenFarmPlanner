// Excel-like "just start typing" (replace cell value) and F2 (edit in place)
// entry points for EditableDataGrid. See docs/datagrid-architecture.md
// ("Keyboard editing/navigation inside the grid") for the broader picture.
import { useCallback, useEffect, useRef } from 'react';
import type React from 'react';
import { flushSync } from 'react-dom';
import { GridRowModes } from '@mui/x-data-grid';
import type { GridCellParams, GridRowId, GridRowModesModel, GridValidRowModel } from '@mui/x-data-grid';
import { EDIT_CELL_FOCUS_TARGET_SELECTOR } from './keyboardNavigation';

type DataGridKeyboardEvent = React.KeyboardEvent & {
  defaultMuiPrevented?: boolean;
};

interface SpreadsheetEditApi {
  getCellElement?: (id: GridRowId, field: string) => HTMLElement | null;
  isCellEditable?: (params: GridCellParams) => boolean;
  setCellFocus?: (id: GridRowId, field: string) => void;
  setEditCellValue?: (params: { id: GridRowId; field: string; value: unknown }) => Promise<boolean> | boolean | void;
}

interface PendingEditValue {
  id: GridRowId;
  field: string;
  value: string;
}

interface UseSpreadsheetEditStarterParams<Row extends GridValidRowModel> {
  apiRef: {
    current?: SpreadsheetEditApi | null;
  };
  rowModesModel: GridRowModesModel;
  setRowModesModel: React.Dispatch<React.SetStateAction<GridRowModesModel>>;
  isCellEditable?: (params: GridCellParams<Row>) => boolean;
  onBeforeEdit?: (params: GridCellParams<Row>) => void;
  onReplaceValue?: (params: GridCellParams<Row>, value: string) => void;
}

interface UseSpreadsheetEditStarterResult<Row extends GridValidRowModel> {
  startEditFromPrintableKey: (
    params: GridCellParams<Row>,
    event: React.KeyboardEvent,
  ) => boolean;
  startEditFromF2: (
    params: GridCellParams<Row>,
    event: React.KeyboardEvent,
  ) => boolean;
}

const getPendingKey = (id: GridRowId, field: string): string => `${String(id)}\u0000${field}`;

const isRowEditing = (rowModesModel: GridRowModesModel, rowId: GridRowId): boolean =>
  rowModesModel[rowId]?.mode === GridRowModes.Edit
  || rowModesModel[String(rowId)]?.mode === GridRowModes.Edit;

const isSpreadsheetPrintableKey = (event: DataGridKeyboardEvent): boolean => (
  event.key.length === 1
  && event.key !== ' '
  && !event.altKey
  && !event.ctrlKey
  && !event.metaKey
  && !event.nativeEvent?.isComposing
);

const markMuiEventHandled = (event: DataGridKeyboardEvent): void => {
  event.preventDefault();
  event.stopPropagation();
  event.defaultMuiPrevented = true;
};

const isEditableEventTarget = (event: DataGridKeyboardEvent): boolean => {
  const target = event.target;
  return target instanceof HTMLElement && Boolean(target.closest(EDIT_CELL_FOCUS_TARGET_SELECTOR));
};

export function useSpreadsheetEditStarter<Row extends GridValidRowModel>({
  apiRef,
  rowModesModel,
  setRowModesModel,
  isCellEditable,
  onBeforeEdit,
  onReplaceValue,
}: UseSpreadsheetEditStarterParams<Row>): UseSpreadsheetEditStarterResult<Row> {
  const pendingValuesRef = useRef<Map<string, PendingEditValue>>(new Map());
  const clearTimersRef = useRef<Map<string, number>>(new Map());
  const focusTimerRef = useRef<number | null>(null);
  const focusFrameRef = useRef<number | null>(null);
  const unmountedRef = useRef(false);

  const cancelScheduledFocus = useCallback((): void => {
    if (focusTimerRef.current !== null) {
      window.clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }
    if (focusFrameRef.current !== null) {
      if (typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(focusFrameRef.current);
      }
      focusFrameRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    unmountedRef.current = true;
    cancelScheduledFocus();
    clearTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    clearTimersRef.current.clear();
    pendingValuesRef.current.clear();
  }, [cancelScheduledFocus]);

  const clearPendingLater = useCallback((pendingKey: string): void => {
    const existingTimer = clearTimersRef.current.get(pendingKey);
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer);
    }
    const timerId = window.setTimeout(() => {
      clearTimersRef.current.delete(pendingKey);
      pendingValuesRef.current.delete(pendingKey);
    }, 250);
    clearTimersRef.current.set(pendingKey, timerId);
  }, []);

  const focusEditInput = useCallback((
    id: GridRowId,
    field: string,
    caretPosition?: number,
  ): void => {
    // A newer focus request supersedes whatever the previous one still had
    // scheduled — otherwise a stale attempt lands on the previously edited
    // cell after this one already focused the new cell.
    cancelScheduledFocus();

    const focusEditor = (): boolean => {
      if (unmountedRef.current) {
        return false;
      }
      const cellElement = apiRef.current?.getCellElement?.(id, field);
      const editor = cellElement?.querySelector<HTMLElement>(EDIT_CELL_FOCUS_TARGET_SELECTOR);
      if (!editor) {
        return false;
      }

      editor.focus({ preventScroll: true });
      if (
        typeof caretPosition === 'number'
        && (editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement)
      ) {
        const position = Math.min(caretPosition, editor.value.length);
        try {
          editor.setSelectionRange(position, position);
        } catch {
          // Some non-text input types expose setSelectionRange but reject it.
        }
      }
      return true;
    };

    // The editor may not be mounted yet, so the same attempt is repeated
    // across a microtask, a macrotask and a frame. The handles are kept so
    // they can be cancelled: an uncancelled timer that fires after the grid
    // unmounted reaches for a cell element that no longer exists — in tests
    // that outlives the jsdom environment and fails the whole run with
    // "document is not defined" even though every test passed.
    focusEditor();
    queueMicrotask(focusEditor);
    focusTimerRef.current = window.setTimeout(() => {
      focusTimerRef.current = null;
      focusEditor();
    }, 0);
    if (typeof window.requestAnimationFrame === 'function') {
      focusFrameRef.current = window.requestAnimationFrame(() => {
        focusFrameRef.current = null;
        focusEditor();
      });
    }
  }, [apiRef, cancelScheduledFocus]);

  const flushPendingValue = useCallback((pendingKey: string): void => {
    const applyPendingValue = (): void => {
      const pendingValue = pendingValuesRef.current.get(pendingKey);
      const api = apiRef.current;
      if (!pendingValue || !api?.setEditCellValue) {
        return;
      }

      const valueAtFlushStart = pendingValue.value;
      void Promise.resolve(api.setEditCellValue({
        id: pendingValue.id,
        field: pendingValue.field,
        value: valueAtFlushStart,
      })).then(() => {
        focusEditInput(pendingValue.id, pendingValue.field, valueAtFlushStart.length);
      });
    };

    applyPendingValue();
    queueMicrotask(applyPendingValue);
    window.setTimeout(applyPendingValue, 0);
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(applyPendingValue);
    }
  }, [apiRef, focusEditInput]);

  const canStartEdit = useCallback((params: GridCellParams<Row>): boolean => {
    if (!params.isEditable || isRowEditing(rowModesModel, params.id)) {
      return false;
    }
    if (isCellEditable && !isCellEditable(params)) {
      return false;
    }
    return apiRef.current?.isCellEditable?.(params as GridCellParams) ?? true;
  }, [apiRef, isCellEditable, rowModesModel]);

  const canReplaceEditingCell = useCallback((
    params: GridCellParams<Row>,
    event: DataGridKeyboardEvent,
  ): boolean => {
    if (
      !params.isEditable
      || !isRowEditing(rowModesModel, params.id)
      || isEditableEventTarget(event)
    ) {
      return false;
    }
    if (isCellEditable && !isCellEditable(params)) {
      return false;
    }
    return apiRef.current?.isCellEditable?.(params as GridCellParams) ?? true;
  }, [apiRef, isCellEditable, rowModesModel]);

  const focusCellForEdit = useCallback((params: GridCellParams<Row>): void => {
    apiRef.current?.setCellFocus?.(params.id, params.field);
    flushSync(() => {
      setRowModesModel((oldModel) => {
        const previousMode = oldModel[params.id] ?? oldModel[String(params.id)] ?? {};
        return {
          ...oldModel,
          [params.id]: {
            ...previousMode,
            mode: GridRowModes.Edit,
            fieldToFocus: params.field,
          },
        };
      });
    });
    focusEditInput(params.id, params.field);
  }, [apiRef, focusEditInput, setRowModesModel]);

  const startEdit = useCallback((params: GridCellParams<Row>): boolean => {
    if (!canStartEdit(params)) {
      return false;
    }

    onBeforeEdit?.(params);
    focusCellForEdit(params);
    return true;
  }, [canStartEdit, focusCellForEdit, onBeforeEdit]);

  const startEditFromPrintableKey = useCallback((
    params: GridCellParams<Row>,
    event: React.KeyboardEvent,
  ): boolean => {
    const keyboardEvent = event as DataGridKeyboardEvent;
    if (!isSpreadsheetPrintableKey(keyboardEvent)) {
      return false;
    }

    const pendingKey = getPendingKey(params.id, params.field);
    const pendingValue = pendingValuesRef.current.get(pendingKey);
    const canEditFromView = canStartEdit(params);
    const canEditFocusedCell = canReplaceEditingCell(params, keyboardEvent);
    if (!pendingValue && !canEditFromView && !canEditFocusedCell) {
      return false;
    }

    markMuiEventHandled(keyboardEvent);
    if (!pendingValue && canEditFromView) {
      onBeforeEdit?.(params);
      focusCellForEdit(params);
    }

    const previousValue = pendingValue?.value ?? '';
    const nextValue = `${previousValue}${keyboardEvent.key}`;
    pendingValuesRef.current.set(pendingKey, {
      id: params.id,
      field: params.field,
      value: nextValue,
    });
    onReplaceValue?.(params, nextValue);
    flushPendingValue(pendingKey);
    clearPendingLater(pendingKey);
    return true;
  }, [
    canReplaceEditingCell,
    canStartEdit,
    clearPendingLater,
    focusCellForEdit,
    flushPendingValue,
    onBeforeEdit,
    onReplaceValue,
  ]);

  const startEditFromF2 = useCallback((
    params: GridCellParams<Row>,
    event: React.KeyboardEvent,
  ): boolean => {
    const keyboardEvent = event as DataGridKeyboardEvent;
    if (
      keyboardEvent.key !== 'F2'
      || keyboardEvent.altKey
      || keyboardEvent.ctrlKey
      || keyboardEvent.metaKey
      || !startEdit(params)
    ) {
      return false;
    }

    markMuiEventHandled(keyboardEvent);
    return true;
  }, [startEdit]);

  return {
    startEditFromPrintableKey,
    startEditFromF2,
  };
}
