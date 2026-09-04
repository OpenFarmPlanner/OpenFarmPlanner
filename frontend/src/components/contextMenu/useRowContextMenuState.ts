import { useCallback, useRef } from 'react';
import { focusContextMenuOrigin, useContextMenuFocus } from './contextMenuFocus';
import {
  useContextMenuPositionState,
  type ContextMenuPositionState,
} from './useContextMenuPositionState';

export type RowContextMenuState<TKey> = ContextMenuPositionState<TKey>;

export interface UseRowContextMenuStateParams {
  /** Whether an event target belongs to a row this menu can open for. Gates
   * the "close this menu if a native context menu opens elsewhere" listener. */
  isContextMenuTarget: (target: EventTarget | null) => boolean;
}

/**
 * Shared open/close/reposition state machine behind both EditableDataGrid's
 * row-action menu (useDataGridRowActionMenu) and FieldsBedsHierarchy's
 * context menu (useHierarchyContextMenu) — see
 * docs/datagrid-architecture.md ("Hover actions / row actions / context
 * menu"). `TKey` is whatever the caller wants to identify the target row by
 * (a row id looked up later, or the row object itself); this hook doesn't
 * care which, it only manages position, focus-restore-on-close, and
 * dismissal when another context menu opens elsewhere.
 */
export function useRowContextMenuState<TKey>({
  isContextMenuTarget,
}: UseRowContextMenuStateParams) {
  const originRef = useRef<HTMLElement | null>(null);

  const restoreFocusToOrigin = useCallback((): void => {
    focusContextMenuOrigin(originRef.current);
  }, []);

  const {
    state,
    open: openAtPosition,
    close,
    clearIf,
  } = useContextMenuPositionState<TKey>({
    isContextMenuTarget,
    onClose: restoreFocusToOrigin,
  });

  const open = useCallback((
    key: TKey,
    mouseX: number,
    mouseY: number,
    origin?: HTMLElement | null,
  ): void => {
    originRef.current = origin ?? null;
    openAtPosition(key, mouseX, mouseY);
  }, [openAtPosition]);

  const listRef = useContextMenuFocus(state !== null, close);

  return { state, originRef, listRef, open, close, clearIf };
}
