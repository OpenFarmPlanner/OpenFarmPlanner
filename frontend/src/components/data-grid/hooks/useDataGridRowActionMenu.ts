import { useCallback, useMemo, useState } from 'react';
import type { GridRowId } from '@mui/x-data-grid';
import { closestContextMenuElement, shouldOpenCustomContextMenu, suppressNativeContextMenu } from '../../../utils/contextMenu';
import { useRowContextMenuState } from '../../contextMenu/useRowContextMenuState';
import { useLongPressTimer } from '../../contextMenu/useLongPressTimer';

const ROW_ACTION_LONG_PRESS_MS = 550;

export interface RowActionMenuState {
  rowId: GridRowId;
  anchorEl?: HTMLElement;
  mouseX?: number;
  mouseY?: number;
}

export interface UseDataGridRowActionMenuParams {
  rowsById: Map<string, unknown>;
  hasContextualRowActions: boolean;
  markContextMenuHintUsed: () => void;
  setSelectedRowIds: React.Dispatch<React.SetStateAction<GridRowId[]>>;
  getRowIdFromElement: (target: EventTarget | null) => GridRowId | null;
}

export function useDataGridRowActionMenu({
  rowsById,
  hasContextualRowActions,
  markContextMenuHintUsed,
  setSelectedRowIds,
  getRowIdFromElement,
}: UseDataGridRowActionMenuParams) {
  const [longPressFeedbackRowId, setLongPressFeedbackRowId] = useState<GridRowId | null>(null);

  const isRowActionContextMenuTarget = useCallback((target: EventTarget | null): boolean => {
    if (!hasContextualRowActions || !shouldOpenCustomContextMenu(target)) {
      return false;
    }
    const rowId = getRowIdFromElement(target);
    return rowId !== null && rowsById.has(String(rowId));
  }, [getRowIdFromElement, hasContextualRowActions, rowsById]);

  const { state: menuState, originRef: menuOriginRef, listRef: menuListRef, open: menuOpen, close: menuClose, clearIf: menuClearIf } =
    useRowContextMenuState<GridRowId>({ isContextMenuTarget: isRowActionContextMenuTarget });
  const longPressTimer = useLongPressTimer(ROW_ACTION_LONG_PRESS_MS);

  const openRowActionMenuAt = useCallback((
    rowId: GridRowId,
    originElement: HTMLElement | null,
    mouseX: number,
    mouseY: number,
  ): void => {
    markContextMenuHintUsed();
    setSelectedRowIds([rowId]);
    menuOpen(rowId, mouseX, mouseY, originElement);
  }, [markContextMenuHintUsed, setSelectedRowIds, menuOpen]);

  const openRowActionContextMenu = useCallback((rowId: GridRowId, event: React.MouseEvent): void => {
    suppressNativeContextMenu(event);
    openRowActionMenuAt(rowId, event.currentTarget as HTMLElement, event.clientX + 2, event.clientY - 6);
  }, [openRowActionMenuAt]);

  const openRowActionKeyboardContextMenu = useCallback((rowId: GridRowId, originElement: HTMLElement): void => {
    const rowElement = originElement.closest<HTMLElement>('[role="row"][data-id]') ?? originElement;
    const rect = rowElement.getBoundingClientRect();
    openRowActionMenuAt(rowId, rowElement, rect.left + Math.min(240, rect.width), rect.top + 12);
  }, [openRowActionMenuAt]);

  const closeRowActionMenu = useCallback((): void => {
    menuClose();
    setLongPressFeedbackRowId(null);
  }, [menuClose]);

  // Used by the parent's clearRowInteractionState when a row is removed.
  const clearRowActionMenuForId = useCallback((rowId: GridRowId): void => {
    const rowKey = String(rowId);
    setLongPressFeedbackRowId((current) => (String(current) === rowKey ? null : current));
    menuClearIf((key) => String(key) === rowKey);
  }, [menuClearIf]);

  const handleGridTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>): void => {
    if (!hasContextualRowActions || event.touches.length !== 1) {
      return;
    }
    if (!shouldOpenCustomContextMenu(event.target)) {
      return;
    }
    const rowId = getRowIdFromElement(event.target);
    if (rowId === null || !rowsById.has(String(rowId))) {
      return;
    }
    const originElement = closestContextMenuElement(event.target, '[role="row"][data-id]');
    const touch = event.touches[0];
    longPressTimer.start(() => {
      markContextMenuHintUsed();
      setSelectedRowIds([rowId]);
      setLongPressFeedbackRowId(rowId);
      menuOpen(rowId, touch.clientX + 2, touch.clientY - 6, originElement);
    });
  }, [longPressTimer, getRowIdFromElement, hasContextualRowActions, markContextMenuHintUsed, rowsById, setSelectedRowIds, menuOpen]);

  const handleGridTouchMove = useCallback((): void => {
    longPressTimer.clear();
  }, [longPressTimer]);

  const handleGridTouchEnd = useCallback((): void => {
    longPressTimer.clear();
  }, [longPressTimer]);

  const rowActionMenuState = useMemo((): RowActionMenuState | null => (
    menuState ? { rowId: menuState.key, mouseX: menuState.mouseX, mouseY: menuState.mouseY } : null
  ), [menuState]);

  return {
    rowActionMenuState,
    longPressFeedbackRowId,
    rowActionMenuOriginRef: menuOriginRef,
    rowActionMenuListRef: menuListRef,
    openRowActionMenuAt,
    openRowActionContextMenu,
    openRowActionKeyboardContextMenu,
    closeRowActionMenu,
    isRowActionContextMenuTarget,
    clearRowActionMenuForId,
    handleGridTouchStart,
    handleGridTouchMove,
    handleGridTouchEnd,
  };
}
