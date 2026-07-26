import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

interface SuppressibleEvent {
  preventDefault: () => void;
  stopPropagation: () => void;
}

/** Duration a touch must be held before it counts as a long press (ca. 500-700ms). */
export const LONG_PRESS_THRESHOLD_MS = 600;

export interface LongPressHandlers {
  onTouchStart: (event: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchMove: () => void;
  /** True while a touch is held but the long-press threshold hasn't fired yet — for optional, low-overhead "pressed" feedback. */
  isLongPressing: boolean;
}

/**
 * Shared touch long-press detection used by the yield distribution, seedling
 * and field occupancy charts to open the same context menu that a desktop
 * right-click opens. A plain tap never fires `onLongPress`; moving the
 * finger or releasing before `thresholdMs` cancels it.
 */
export function useLongPress(
  onLongPress: (event: React.TouchEvent) => void,
  thresholdMs: number = LONG_PRESS_THRESHOLD_MS,
): LongPressHandlers {
  const timeoutRef = useRef<number | null>(null);
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
    setIsLongPressing(true);
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      setIsLongPressing(false);
      onLongPress(event);
    }, thresholdMs);
  }, [onLongPress, thresholdMs]);

  return { onTouchStart, onTouchEnd: clear, onTouchMove: clear, isLongPressing };
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
}

export function useCloseCustomContextMenuOnNativeContextMenu(
  open: boolean,
  onClose: () => void,
  isCustomContextMenuTarget: (target: EventTarget | null) => boolean,
  onOpenMenuContextMenu?: (event: MouseEvent) => void,
): void {
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
      if (event.button !== 0) {
        return;
      }
      if (closestContextMenuElement(event.target, customContextMenuSelector) !== null) {
        return;
      }

      onClose();
    };

    document.addEventListener('mousedown', handleDocumentMouseDown, true);

    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown, true);
    };
  }, [onClose, open]);
}
