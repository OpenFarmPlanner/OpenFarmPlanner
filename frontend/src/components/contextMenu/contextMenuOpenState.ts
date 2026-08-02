/**
 * Global "is any context menu currently open?" signal.
 *
 * Every app context menu funnels through `useContextMenuPositionState`, which
 * registers here for as long as it is open. Tooltip surfaces subscribe to it
 * (`AppTooltip`, the Gantt task tooltip, the notes preview popover) so an
 * open context menu can never be covered by a tooltip: visible tooltips close
 * immediately and new ones stay suppressed until the menu is gone.
 *
 * This is deliberately a module-level store rather than a React context: the
 * menus and the tooltips live in unrelated subtrees (and partly in portals),
 * and a tooltip must react to a menu opening anywhere in the app, not just
 * above it. Raising the menu's z-index instead would only paint over a
 * tooltip that is still open, still measured, and still stealing hover.
 */

import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';

export interface ContextMenuOpenSnapshot {
  /** Whether at least one context menu is open right now. */
  open: boolean;
  /**
   * Counts how often a context menu opened while none was open. Tooltips use
   * it to invalidate an open state from before the menu appeared, without
   * having to reset that state from an effect.
   */
  openSequence: number;
}

type ContextMenuOpenListener = () => void;

const openContextMenus = new Set<symbol>();
const listeners = new Set<ContextMenuOpenListener>();

const CLOSED_SNAPSHOT: ContextMenuOpenSnapshot = { open: false, openSequence: 0 };

let snapshot: ContextMenuOpenSnapshot = CLOSED_SNAPSHOT;

function publishSnapshot(): void {
  const open = openContextMenus.size > 0;
  if (open === snapshot.open) {
    return;
  }

  snapshot = {
    open,
    openSequence: open ? snapshot.openSequence + 1 : snapshot.openSequence,
  };
  listeners.forEach((listener) => {
    listener();
  });
}

export function getContextMenuOpenSnapshot(): ContextMenuOpenSnapshot {
  return snapshot;
}

export function isAnyContextMenuOpen(): boolean {
  return snapshot.open;
}

/**
 * Marks one context menu as open until the returned release function runs.
 * Ref-counted by menu identity, so overlapping menus (one opening while
 * another is still closing) can't clear the flag for each other.
 */
export function registerOpenContextMenu(menuId: symbol): () => void {
  openContextMenus.add(menuId);
  publishSnapshot();

  return () => {
    if (!openContextMenus.delete(menuId)) {
      return;
    }
    publishSnapshot();
  };
}

export function subscribeToContextMenuOpenState(listener: ContextMenuOpenListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Reactive read of the whole snapshot. */
export function useContextMenuOpenSnapshot(): ContextMenuOpenSnapshot {
  return useSyncExternalStore(
    subscribeToContextMenuOpenState,
    getContextMenuOpenSnapshot,
    () => CLOSED_SNAPSHOT,
  );
}

/** Reactive read of {@link isAnyContextMenuOpen}. */
export function useIsAnyContextMenuOpen(): boolean {
  return useContextMenuOpenSnapshot().open;
}

/**
 * Registers the calling context menu as open while `open` is true.
 *
 * Registration runs in a layout effect so the flag is set in the same commit
 * that renders the menu — a tooltip that is open at that moment is hidden
 * before the browser paints the menu, never one frame on top of it.
 */
export function useContextMenuOpenRegistration(open: boolean): void {
  const [menuId] = useState(() => Symbol('contextMenu'));

  useLayoutEffect(() => {
    if (!open) {
      return undefined;
    }
    return registerOpenContextMenu(menuId);
  }, [menuId, open]);
}

/**
 * Runs `onContextMenuOpened` whenever a context menu opens while none was
 * open before. Used by tooltip-like surfaces that keep their own timers and
 * therefore need to actively cancel pending work, not just re-render.
 */
export function useOnContextMenuOpened(onContextMenuOpened: () => void): void {
  const callbackRef = useRef(onContextMenuOpened);

  useLayoutEffect(() => {
    callbackRef.current = onContextMenuOpened;
  }, [onContextMenuOpened]);

  const handleChange = useCallback((): void => {
    if (isAnyContextMenuOpen()) {
      callbackRef.current();
    }
  }, []);

  useLayoutEffect(() => subscribeToContextMenuOpenState(handleChange), [handleChange]);
}
