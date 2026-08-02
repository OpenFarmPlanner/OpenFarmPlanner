import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';

interface SuppressibleEvent {
  preventDefault: () => void;
  stopPropagation: () => void;
  stopImmediatePropagation?: () => void;
  nativeEvent?: {
    stopImmediatePropagation?: () => void;
  };
}

/** Duration a touch must be held before it counts as a long press (ca. 500-700ms). */
export const LONG_PRESS_THRESHOLD_MS = 600;

export interface LongPressHandlers {
  onTouchStart: (event: React.TouchEvent) => void;
  onTouchEnd: (event: React.TouchEvent) => void;
  onTouchMove: () => void;
  /** True while a touch is held but the long-press threshold hasn't fired yet — for optional, low-overhead "pressed" feedback. */
  isLongPressing: boolean;
}

/**
 * Whether the device's primary pointer is coarse (touch) rather than fine
 * (mouse/trackpad). This is the single signal the table-interaction model
 * (hover-action visibility, tap-vs-long-press, hint copy) is keyed on —
 * actual input capability, not viewport width, per the touch/desktop split
 * documented in docs/datagrid-architecture.md. A hybrid device (laptop with
 * a touchscreen but a mouse as primary pointer) reports `false` here, same
 * as a mouse-only desktop — that's the correct simplification: such a
 * device's *primary* interaction is still mouse-driven.
 */
export function useIsCoarsePointer(): boolean {
  return useMediaQuery('(pointer: coarse)');
}

/**
 * Shared touch long-press detection used by the yield distribution, seedling
 * and field occupancy charts to open the same context menu that a desktop
 * right-click opens. A plain tap never fires `onLongPress`; moving the
 * finger or releasing before `thresholdMs` cancels it.
 *
 * `onTouchEnd` must be wired up even when the caller doesn't otherwise need
 * a touchend handler: once a long press has fired, the browser still
 * synthesizes a trailing `click` on release unless that click is
 * suppressed, which would otherwise also run the element's own tap
 * action (open/edit/navigate) right on top of the context menu that long
 * press just opened. `onTouchEnd` calls `event.preventDefault()` to stop
 * that synthetic click exactly when a long press fired — never on a plain
 * tap or a cancelled press, so normal taps are unaffected.
 */
export function useLongPress(
  onLongPress: (event: React.TouchEvent) => void,
  thresholdMs: number = LONG_PRESS_THRESHOLD_MS,
): LongPressHandlers {
  const timeoutRef = useRef<number | null>(null);
  const firedRef = useRef(false);
  const [isLongPressing, setIsLongPressing] = useState(false);

  const clear = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsLongPressing(false);
  }, []);

  const onTouchStart = useCallback((event: React.TouchEvent) => {
    if (!event.touches[0]) return;
    firedRef.current = false;
    setIsLongPressing(true);
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      firedRef.current = true;
      setIsLongPressing(false);
      onLongPress(event);
    }, thresholdMs);
  }, [onLongPress, thresholdMs]);

  // Cancelling on move (not just clearing the timer) keeps a long-press
  // gesture from ever fighting normal vertical scrolling — any finger
  // movement, including the start of a scroll, cancels the pending press.
  const onTouchMove = useCallback((): void => {
    clear();
  }, [clear]);

  const onTouchEnd = useCallback((event: React.TouchEvent): void => {
    clear();
    if (firedRef.current) {
      event.preventDefault();
      firedRef.current = false;
    }
  }, [clear]);

  return { onTouchStart, onTouchEnd, onTouchMove, isLongPressing };
}

const editableSelector = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[role="textbox"]',
].join(',');

const customContextMenuSelector = '.ofp-custom-context-menu, [role="menu"]';

/**
 * Right-clicking (or long-pressing) directly on an SVG icon inside a button
 * — e.g. MUI's `<IconButton><SomeIcon /></IconButton>`, used for every
 * inline row-action affordance — makes the native event's `target` an
 * `SVGElement`/`SVGPathElement`, not an `HTMLElement`. SVGElement is a
 * sibling of HTMLElement under `Element`, not a subtype of it, so any
 * `target instanceof HTMLElement` check silently fails for icon hits even
 * though `closest()` (defined on `Element`) resolves identically for both.
 * Row/target matching for context menus must walk up via `Element`, not
 * `HTMLElement`, or every icon/IconButton inside a row falls through to the
 * native browser context menu instead of the app's own one.
 */
export function closestContextMenuElement<T extends Element = HTMLElement>(
  target: EventTarget | null,
  selector: string,
): T | null {
  return target instanceof Element ? target.closest<T>(selector) : null;
}

export function isEditableContextMenuTarget(target: EventTarget | null): boolean {
  return closestContextMenuElement(target, editableSelector) !== null;
}

export function shouldOpenCustomContextMenu(target: EventTarget | null): boolean {
  return !isEditableContextMenuTarget(target);
}

export function suppressNativeContextMenu(event: SuppressibleEvent): void {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  event.nativeEvent?.stopImmediatePropagation?.();
}

function stopEventImmediately(event: Event, options: { preventDefault?: boolean } = {}): void {
  if (options.preventDefault && event.cancelable) {
    event.preventDefault();
  }
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function isPrimaryButtonEvent(event: MouseEvent | PointerEvent): boolean {
  return event.button === 0;
}

function isSecondaryButtonEvent(event: MouseEvent | PointerEvent): boolean {
  return event.button === 2;
}

function armDismissedContextMenuClickSuppression(): void {
  const stopPendingMouseEvent = (event: MouseEvent | PointerEvent): void => {
    if (isPrimaryButtonEvent(event)) {
      stopEventImmediately(event, { preventDefault: true });
    }
  };

  const stopPendingClick = (event: MouseEvent): void => {
    stopEventImmediately(event, { preventDefault: true });
    cleanup();
  };

  const cleanup = (): void => {
    document.removeEventListener('pointerup', stopPendingMouseEvent, true);
    document.removeEventListener('mouseup', stopPendingMouseEvent, true);
    document.removeEventListener('click', stopPendingClick, true);
    window.clearTimeout(cleanupTimer);
  };

  document.addEventListener('pointerup', stopPendingMouseEvent, true);
  document.addEventListener('mouseup', stopPendingMouseEvent, true);
  document.addEventListener('click', stopPendingClick, true);

  const cleanupTimer = window.setTimeout(cleanup, 1000);
}

export function useCloseCustomContextMenuOnNativeContextMenu(
  open: boolean,
  onClose: () => void,
  isCustomContextMenuTarget: (target: EventTarget | null) => boolean,
  onOpenMenuContextMenu?: (event: MouseEvent) => void,
): void {
  useEffect(() => {
    const handleSecondaryPointerEvent = (event: MouseEvent | PointerEvent): void => {
      if (!isSecondaryButtonEvent(event) || !isCustomContextMenuTarget(event.target)) {
        return;
      }

      stopEventImmediately(event);
    };

    document.addEventListener('pointerdown', handleSecondaryPointerEvent, true);
    document.addEventListener('mousedown', handleSecondaryPointerEvent, true);
    document.addEventListener('pointerup', handleSecondaryPointerEvent, true);
    document.addEventListener('mouseup', handleSecondaryPointerEvent, true);

    return () => {
      document.removeEventListener('pointerdown', handleSecondaryPointerEvent, true);
      document.removeEventListener('mousedown', handleSecondaryPointerEvent, true);
      document.removeEventListener('pointerup', handleSecondaryPointerEvent, true);
      document.removeEventListener('mouseup', handleSecondaryPointerEvent, true);
    };
  }, [isCustomContextMenuTarget]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleDocumentContextMenu = (event: MouseEvent): void => {
      if (isCustomContextMenuTarget(event.target)) {
        return;
      }

      if (closestContextMenuElement(event.target, customContextMenuSelector) !== null) {
        event.preventDefault();
        event.stopPropagation();
        onOpenMenuContextMenu?.(event);
        return;
      }

      onClose();
    };

    document.addEventListener('contextmenu', handleDocumentContextMenu, true);

    return () => {
      document.removeEventListener('contextmenu', handleDocumentContextMenu, true);
    };
  }, [isCustomContextMenuTarget, onClose, onOpenMenuContextMenu, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleDocumentMouseDown = (event: MouseEvent): void => {
      if (!isPrimaryButtonEvent(event)) {
        return;
      }
      if (closestContextMenuElement(event.target, customContextMenuSelector) !== null) {
        return;
      }

      stopEventImmediately(event, { preventDefault: true });
      armDismissedContextMenuClickSuppression();
      onClose();
    };

    const handleDocumentPointerDown = (event: PointerEvent): void => {
      if (!isPrimaryButtonEvent(event)) {
        return;
      }
      if (closestContextMenuElement(event.target, customContextMenuSelector) !== null) {
        return;
      }

      stopEventImmediately(event, { preventDefault: true });
    };

    document.addEventListener('pointerdown', handleDocumentPointerDown, true);
    document.addEventListener('mousedown', handleDocumentMouseDown, true);

    return () => {
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
      document.removeEventListener('mousedown', handleDocumentMouseDown, true);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    // `CustomContextMenu` deliberately renders with `hideBackdrop` and
    // `pointerEvents: 'none'` on its root (see CustomContextMenu.tsx), so a
    // tap outside it reaches the DOM underneath same as if the menu weren't
    // there — the mousedown listener above is what actually closes it. On
    // desktop that's fine and intentional: a left click that dismisses the
    // menu also acting on whatever's under the cursor matches how a native
    // context menu behaves, and changing that isn't asked for here.
    //
    // On touch a single tap must ONLY dismiss the menu — not also start
    // editing the cell (or run whatever tap action) the finger landed on.
    // preventDefault() on `touchstart` suppresses the entire synthetic
    // mousedown/mouseup/click sequence the browser would otherwise
    // synthesize from this touch, and stopPropagation() keeps the same
    // touchstart from also arming that target's own long-press timer. The
    // next, separate tap is completely unaffected — this listener is torn
    // down as soon as `open` becomes false.
    const handleDocumentTouchStart = (event: TouchEvent): void => {
      if (closestContextMenuElement(event.target, customContextMenuSelector) !== null) {
        return;
      }

      stopEventImmediately(event, { preventDefault: true });
      onClose();
    };

    document.addEventListener('touchstart', handleDocumentTouchStart, { capture: true, passive: false });

    return () => {
      document.removeEventListener('touchstart', handleDocumentTouchStart, true);
    };
  }, [onClose, open]);
}
