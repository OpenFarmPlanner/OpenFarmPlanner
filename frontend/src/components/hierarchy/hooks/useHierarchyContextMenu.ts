// Right-click/long-press row-action menu for FieldsBedsHierarchy's raw MUI
// DataGrid. Shares its open/close/reposition state machine with
// EditableDataGrid's useDataGridRowActionMenu via useRowContextMenuState -
// see docs/datagrid-architecture.md ("Hover actions / row actions / context
// menu"). What's NOT shared is deliberate: this hook opens on a right-click
// anywhere in the row (or the name cell specifically) and stores the whole
// row object, while EditableDataGrid opens via an explicit inline action
// icon and stores only a row id looked up separately. Those differences are
// UX/data-shape choices, not something to unify further.
import { useCallback, useMemo } from "react";
import type { HierarchyRow } from "../utils/types";
import { closestContextMenuElement, shouldOpenCustomContextMenu, suppressNativeContextMenu } from "../../../utils/contextMenu";
import { useRowContextMenuState } from "../../contextMenu/useRowContextMenuState";
import { ROW_LONG_PRESS_MS, useLongPressTimer } from "../../contextMenu/useLongPressTimer";

interface ContextMenuState {
  row: HierarchyRow;
  mouseX: number;
  mouseY: number;
}

interface UseHierarchyContextMenuParams {
  rows: HierarchyRow[];
  markContextMenuHintUsed: () => void;
  markTouchContextMenuHintUsed: () => void;
  setSelectedRowId: (id: string | number) => void;
  setTreeActive: (active: boolean) => void;
}

export function useHierarchyContextMenu({
  rows,
  markContextMenuHintUsed,
  markTouchContextMenuHintUsed,
  setSelectedRowId,
  setTreeActive,
}: UseHierarchyContextMenuParams) {
  const isHierarchyContextMenuTarget = useCallback(
    (target: EventTarget | null): boolean => {
      if (!shouldOpenCustomContextMenu(target)) {
        return false;
      }
      const rowElement = closestContextMenuElement(target, '[role="row"][data-id]');
      const rowId = rowElement?.dataset.id;
      return Boolean(rowId && rows.some((row) => String(row.id) === rowId));
    },
    [rows],
  );

  const { state: menuState, listRef: menuListRef, open: menuOpen, close: menuClose } =
    useRowContextMenuState<HierarchyRow>({ isContextMenuTarget: isHierarchyContextMenuTarget });
  const longPressTimer = useLongPressTimer(ROW_LONG_PRESS_MS);

  const openContextMenuForRow = useCallback(
    (
      row: HierarchyRow,
      mouseX: number,
      mouseY: number,
      origin?: HTMLElement | null,
      options?: { markHint?: 'desktop' | 'touch' | false },
    ): void => {
      const markHint = options?.markHint ?? 'desktop';
      if (markHint === 'desktop') {
        markContextMenuHintUsed();
      } else if (markHint === 'touch') {
        markTouchContextMenuHintUsed();
      }
      setSelectedRowId(row.id as string | number);
      setTreeActive(true);
      menuOpen(row, mouseX, mouseY, origin ?? null);
    },
    [markContextMenuHintUsed, markTouchContextMenuHintUsed, setSelectedRowId, setTreeActive, menuOpen],
  );

  const handleNameCellContextMenu = useCallback(
    (
      event:
        | React.MouseEvent<HTMLElement>
        | React.PointerEvent<HTMLElement>
        | React.TouchEvent<HTMLElement>
        | React.KeyboardEvent<HTMLElement>,
      row: HierarchyRow,
    ): void => {
      if (!shouldOpenCustomContextMenu(event.target)) return;
      suppressNativeContextMenu(event);
      const hasPointerCoordinates =
        "clientX" in event &&
        "clientY" in event &&
        typeof event.clientX === "number" &&
        typeof event.clientY === "number" &&
        Number.isFinite(event.clientX) &&
        Number.isFinite(event.clientY) &&
        (event.clientX !== 0 || event.clientY !== 0);
      if (hasPointerCoordinates) {
        openContextMenuForRow(row, event.clientX + 2, event.clientY - 6, event.currentTarget);
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      openContextMenuForRow(row, rect.right - 8, rect.top + 12, event.currentTarget);
    },
    [openContextMenuForRow],
  );

  const handleGridContextMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>): void => {
      if (!isHierarchyContextMenuTarget(event.target)) return;
      const rowElement = closestContextMenuElement(event.target, '[role="row"][data-id]');
      const rowId = rowElement?.dataset.id;
      if (!rowId) return;
      const targetRow = rows.find((row) => String(row.id) === rowId);
      if (!targetRow) return;
      suppressNativeContextMenu(event);
      setSelectedRowId(targetRow.id as string | number);
      setTreeActive(true);
      openContextMenuForRow(targetRow, event.clientX + 2, event.clientY - 6, rowElement);
    },
    [isHierarchyContextMenuTarget, openContextMenuForRow, rows, setSelectedRowId, setTreeActive],
  );

  const handleGridTouchStart = useCallback(
    (event: React.TouchEvent<HTMLElement>): void => {
      if (!shouldOpenCustomContextMenu(event.target)) return;
      const rowElement = closestContextMenuElement(event.target, '[role="row"][data-id]');
      const rowId = rowElement?.dataset.id;
      if (!rowId) return;
      const targetRow = rows.find((row) => String(row.id) === rowId);
      const touch = event.touches[0];
      if (!targetRow || !touch) return;
      longPressTimer.start(() => {
        openContextMenuForRow(targetRow, touch.clientX, touch.clientY, rowElement, {
          markHint: 'touch',
        });
      });
    },
    [longPressTimer, openContextMenuForRow, rows],
  );

  // Cancels a pending long press on any finger movement, so it never fights
  // normal vertical scrolling — this was previously missing here (only
  // touchend cleared the timer), unlike EditableDataGrid's equivalent.
  const handleGridTouchMove = useCallback((): void => {
    longPressTimer.clear();
  }, [longPressTimer]);

  // Suppresses the trailing click after a long press fired, so it doesn't
  // also run the grid's own tap behavior (cell selection/edit-start) right
  // on top of the context menu that long press just opened.
  const handleGridTouchEnd = useCallback((event: React.TouchEvent<HTMLElement>): void => {
    longPressTimer.endTouch(event);
  }, [longPressTimer]);

  const contextMenuState = useMemo((): ContextMenuState | null => (
    menuState ? { row: menuState.key, mouseX: menuState.mouseX, mouseY: menuState.mouseY } : null
  ), [menuState]);

  return {
    contextMenuState,
    openContextMenuForRow,
    handleNameCellContextMenu,
    isHierarchyContextMenuTarget,
    handleGridContextMenu,
    handleGridTouchStart,
    handleGridTouchMove,
    handleGridTouchEnd,
    closeContextMenu: menuClose,
    contextMenuListRef: menuListRef,
  };
}
