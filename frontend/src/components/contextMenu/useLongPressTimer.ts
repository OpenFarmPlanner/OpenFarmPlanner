import { useCallback, useEffect, useRef } from 'react';

interface SuppressibleTouchEvent {
  preventDefault: () => void;
}

/**
 * Shared touch long-press duration for every row-level context menu
 * (EditableDataGrid, FieldsBedsHierarchy, Suppliers, SeedDemand) built on
 * this hook. Keep every caller on this one constant instead of a
 * table-local magic number, so "how long is a long press" stays one
 * decision, not four independently-tunable ones.
 */
export const ROW_LONG_PRESS_MS = 550;

/**
 * Minimal touch-long-press timer: start(fire) (re)arms a single timeout,
 * clear() cancels it, and the timer is always cancelled on unmount. Callers
 * own their own touch-target validation before calling start() - this hook
 * only manages the timer lifecycle, not what counts as a valid long-press
 * target.
 */
export function useLongPressTimer(durationMs: number) {
  const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const firedRef = useRef(false);

  const clear = useCallback((): void => {
    if (timerRef.current === null) {
      return;
    }
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => () => clear(), [clear]);

  const start = useCallback((fire: () => void): void => {
    clear();
    firedRef.current = false;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      firedRef.current = true;
      fire();
    }, durationMs);
  }, [clear, durationMs]);

  /**
   * Call from onTouchEnd/onTouchCancel: clears any pending timer, and if a
   * long press just fired, prevents the browser's trailing synthetic click
   * so a long press that opened the context menu doesn't also trigger the
   * row's own tap action (edit, cell-edit-start, navigation, ...) right on
   * top of it. No-ops on a plain tap or a press that was cancelled by
   * movement — only a press that actually fired suppresses the click.
   */
  const endTouch = useCallback((event: SuppressibleTouchEvent): void => {
    clear();
    if (firedRef.current) {
      event.preventDefault();
      firedRef.current = false;
    }
  }, [clear]);

  return { start, clear, endTouch };
}
