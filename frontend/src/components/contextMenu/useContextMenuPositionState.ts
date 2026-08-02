import { useCallback, useEffect, useState } from 'react';
import { useCloseCustomContextMenuOnNativeContextMenu } from '../../utils/contextMenu';
import {
  closeOtherContextMenus,
  registerContextMenuCloseHandler,
  useContextMenuOpenRegistration,
} from './contextMenuOpenState';

export interface ContextMenuPositionState<TKey> {
  key: TKey;
  mouseX: number;
  mouseY: number;
}

interface UseContextMenuPositionStateParams {
  /** Whether an event target belongs to an element this menu can open for.
   * Used to decide whether another native context-menu event should close or
   * reposition the current custom menu. */
  isContextMenuTarget: (target: EventTarget | null) => boolean;
  onClose?: () => void;
}

export function useContextMenuPositionState<TKey>({
  isContextMenuTarget,
  onClose,
}: UseContextMenuPositionStateParams) {
  const [menuId] = useState(() => Symbol('contextMenu'));
  const [state, setState] = useState<ContextMenuPositionState<TKey> | null>(null);

  const open = useCallback((
    key: TKey,
    mouseX: number,
    mouseY: number,
  ): void => {
    closeOtherContextMenus(menuId);
    setState({ key, mouseX, mouseY });
  }, [menuId]);

  const close = useCallback((): void => {
    setState(null);
    onClose?.();
  }, [onClose]);

  const clearIf = useCallback((predicate: (key: TKey) => boolean): void => {
    setState((current) => (current && predicate(current.key) ? null : current));
  }, []);

  const reposition = useCallback((event: globalThis.MouseEvent): void => {
    setState((current) => (
      current ? { key: current.key, mouseX: event.clientX + 2, mouseY: event.clientY - 6 } : current
    ));
  }, []);

  useCloseCustomContextMenuOnNativeContextMenu(
    state !== null,
    close,
    isContextMenuTarget,
    reposition,
  );

  // Single place every app context menu reports "I am open" from, so tooltips
  // can hide themselves instead of covering the menu.
  useContextMenuOpenRegistration(state !== null, menuId);

  useEffect(() => registerContextMenuCloseHandler(menuId, close), [close, menuId]);

  return { state, open, close, clearIf };
}
