import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react';

import {
  GANTT_LEFT_COLUMN_DESKTOP_DEFAULT_WIDTH,
  GANTT_LEFT_COLUMN_DESKTOP_MAX_WIDTH,
  GANTT_LEFT_COLUMN_DESKTOP_MIN_WIDTH,
  GANTT_LEFT_COLUMN_MOBILE_DEFAULT_WIDTH,
  GANTT_LEFT_COLUMN_MOBILE_MAX_WIDTH,
  GANTT_LEFT_COLUMN_MOBILE_MIN_WIDTH,
  GANTT_SIDEBAR_RESIZE_HANDLE_DESKTOP_HITBOX_WIDTH,
  GANTT_SIDEBAR_RESIZE_HANDLE_MOBILE_HITBOX_WIDTH,
  GANTT_SIDEBAR_RESIZE_KEYBOARD_STEP,
  type StoredGanttState,
  clampGanttLeftColumnWidth,
  storeGanttState,
} from './ganttChartState';

interface UseGanttSidebarResizeOptions {
  /** Where the width is persisted; `null` disables persistence. */
  storageKey: string | null;
  storedState: StoredGanttState | null;
  /** Mobile and desktop keep separate widths, limits and handle hitboxes. */
  useMobileLimits: boolean;
}

interface GanttSidebarResize {
  width: number;
  /** The current width without the re-render, for effects that must not re-run on drag. */
  widthRef: RefObject<number>;
  minWidth: number;
  maxWidth: number;
  handleHitboxWidth: number;
  isResizing: boolean;
  handleResizeStart: (event: ReactPointerEvent<HTMLElement>) => void;
  handleResizeKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
}

/**
 * Width of the calendar's left (task list) column and the drag/keyboard
 * interactions that change it. Mobile and desktop are stored separately so
 * rotating a phone or resizing a window restores the width that breakpoint
 * was last left at, rather than carrying one over to the other.
 */
export function useGanttSidebarResize({
  storageKey,
  storedState,
  useMobileLimits,
}: UseGanttSidebarResizeOptions): GanttSidebarResize {
  const [widthDesktop, setWidthDesktop] = useState(
    storedState?.leftColumnWidthDesktop
      ?? storedState?.leftColumnWidth
      ?? GANTT_LEFT_COLUMN_DESKTOP_DEFAULT_WIDTH,
  );
  const [widthMobile, setWidthMobile] = useState(
    storedState?.leftColumnWidthMobile ?? GANTT_LEFT_COLUMN_MOBILE_DEFAULT_WIDTH,
  );
  const [isResizing, setIsResizing] = useState(false);
  const widthFrameRef = useRef<number | null>(null);

  const width = useMobileLimits ? widthMobile : widthDesktop;
  const minWidth = useMobileLimits ? GANTT_LEFT_COLUMN_MOBILE_MIN_WIDTH : GANTT_LEFT_COLUMN_DESKTOP_MIN_WIDTH;
  const maxWidth = useMobileLimits ? GANTT_LEFT_COLUMN_MOBILE_MAX_WIDTH : GANTT_LEFT_COLUMN_DESKTOP_MAX_WIDTH;
  const handleHitboxWidth = useMobileLimits
    ? GANTT_SIDEBAR_RESIZE_HANDLE_MOBILE_HITBOX_WIDTH
    : GANTT_SIDEBAR_RESIZE_HANDLE_DESKTOP_HITBOX_WIDTH;
  const widthRef = useRef(width);

  const storedWidthDesktop = storedState?.leftColumnWidthDesktop;
  const storedWidthLegacy = storedState?.leftColumnWidth;
  const storedWidthMobile = storedState?.leftColumnWidthMobile;

  useEffect(() => {
    setWidthDesktop(storedWidthDesktop ?? storedWidthLegacy ?? GANTT_LEFT_COLUMN_DESKTOP_DEFAULT_WIDTH);
    setWidthMobile(storedWidthMobile ?? GANTT_LEFT_COLUMN_MOBILE_DEFAULT_WIDTH);
  }, [storageKey, storedWidthDesktop, storedWidthLegacy, storedWidthMobile]);

  useEffect(() => () => {
    if (widthFrameRef.current !== null) {
      window.cancelAnimationFrame(widthFrameRef.current);
    }
  }, []);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  const persistWidth = useCallback((nextWidth: number, forMobile: boolean) => {
    storeGanttState(storageKey, {
      [forMobile ? 'leftColumnWidthMobile' : 'leftColumnWidthDesktop']: clampGanttLeftColumnWidth(
        nextWidth,
        forMobile,
      ),
    });
  }, [storageKey]);

  const handleResizeStart = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const target = event.currentTarget;
    if (target.setPointerCapture) {
      target.setPointerCapture(event.pointerId);
    }

    const forMobile = useMobileLimits;
    const startClientX = event.clientX;
    const startWidth = width;
    let pendingWidth = startWidth;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    const previousTouchAction = document.body.style.touchAction;
    let isFinished = false;

    const setActiveWidth = (nextWidth: number): void => {
      if (forMobile) {
        setWidthMobile(nextWidth);
      } else {
        setWidthDesktop(nextWidth);
      }
    };

    const applyPendingWidth = (): void => {
      widthFrameRef.current = null;
      setActiveWidth(pendingWidth);
    };

    const queueWidthUpdate = (nextWidth: number): void => {
      pendingWidth = clampGanttLeftColumnWidth(nextWidth, forMobile);
      if (widthFrameRef.current === null) {
        widthFrameRef.current = window.requestAnimationFrame(applyPendingWidth);
      }
    };

    const finishResize = (finishEvent?: Event): void => {
      if (isFinished) {
        return;
      }
      isFinished = true;
      finishEvent?.preventDefault();
      if (widthFrameRef.current !== null) {
        window.cancelAnimationFrame(widthFrameRef.current);
        widthFrameRef.current = null;
      }
      setActiveWidth(pendingWidth);
      persistWidth(pendingWidth, forMobile);
      setIsResizing(false);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      document.body.style.touchAction = previousTouchAction;
      if (target.releasePointerCapture && target.hasPointerCapture?.(event.pointerId)) {
        target.releasePointerCapture(event.pointerId);
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishResize, { capture: true });
      window.removeEventListener('pointercancel', finishResize, { capture: true });
      target.removeEventListener('lostpointercapture', finishResize);
    };

    const handlePointerMove = (moveEvent: PointerEvent): void => {
      moveEvent.preventDefault();
      queueWidthUpdate(startWidth + moveEvent.clientX - startClientX);
    };

    setIsResizing(true);
    document.body.style.cursor = forMobile ? previousCursor : 'col-resize';
    document.body.style.userSelect = 'none';
    document.body.style.touchAction = 'none';
    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', finishResize, { passive: false, capture: true });
    window.addEventListener('pointercancel', finishResize, { passive: false, capture: true });
    target.addEventListener('lostpointercapture', finishResize, { passive: false });
  }, [persistWidth, useMobileLimits, width]);

  const handleResizeKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    let nextWidth: number | null = null;
    if (event.key === 'ArrowLeft') {
      nextWidth = width - GANTT_SIDEBAR_RESIZE_KEYBOARD_STEP;
    } else if (event.key === 'ArrowRight') {
      nextWidth = width + GANTT_SIDEBAR_RESIZE_KEYBOARD_STEP;
    } else if (event.key === 'Home') {
      nextWidth = minWidth;
    } else if (event.key === 'End') {
      nextWidth = maxWidth;
    }

    if (nextWidth === null) {
      return;
    }

    event.preventDefault();
    const clampedWidth = clampGanttLeftColumnWidth(nextWidth, useMobileLimits);
    if (useMobileLimits) {
      setWidthMobile(clampedWidth);
    } else {
      setWidthDesktop(clampedWidth);
    }
    persistWidth(clampedWidth, useMobileLimits);
  }, [maxWidth, minWidth, persistWidth, useMobileLimits, width]);

  return {
    width,
    widthRef,
    minWidth,
    maxWidth,
    handleHitboxWidth,
    isResizing,
    handleResizeStart,
    handleResizeKeyDown,
  };
}
