/**
 * State manager for the notes preview popover.
 *
 * Tracks which single row/field is currently previewed (at most one at a
 * time, shared across the whole grid) so only one Popover instance needs to
 * be rendered regardless of row count. Hover opens with a short delay to
 * avoid flicker while the pointer passes over several cells; keyboard focus
 * and touch open immediately.
 *
 * Like every tooltip-style surface, the preview is suppressed while a context
 * menu is open (see components/contextMenu/contextMenuOpenState.ts): opening
 * a menu closes it and cancels a pending hover delay, and no new preview
 * opens until the menu is gone.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type { GridRowId } from '@mui/x-data-grid';
import { isAnyContextMenuOpen, useOnContextMenuOpened } from '../contextMenu/contextMenuOpenState';

const HOVER_OPEN_DELAY_MS = 250;
const CLOSE_DELAY_MS = 200;

export type NotesPreviewOpenMode = 'hover' | 'immediate';

interface NotesPreviewState {
  anchorEl: HTMLElement;
  rowId: GridRowId;
  field: string;
}

export interface UseNotesPreviewReturn {
  state: NotesPreviewState | null;
  openPreview: (anchorEl: HTMLElement, rowId: GridRowId, field: string, mode: NotesPreviewOpenMode) => void;
  scheduleClose: () => void;
  cancelScheduledClose: () => void;
  close: () => void;
}

export function useNotesPreview(): UseNotesPreviewReturn {
  const [state, setState] = useState<NotesPreviewState | null>(null);
  const openTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const cancelOpenTimer = useCallback((): void => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  const cancelCloseTimer = useCallback((): void => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openPreview = useCallback((
    anchorEl: HTMLElement,
    rowId: GridRowId,
    field: string,
    mode: NotesPreviewOpenMode,
  ): void => {
    cancelCloseTimer();
    cancelOpenTimer();

    if (isAnyContextMenuOpen()) {
      return;
    }

    if (mode === 'immediate') {
      setState({ anchorEl, rowId, field });
      return;
    }

    openTimerRef.current = window.setTimeout(() => {
      openTimerRef.current = null;
      if (isAnyContextMenuOpen()) {
        return;
      }
      setState({ anchorEl, rowId, field });
    }, HOVER_OPEN_DELAY_MS);
  }, [cancelCloseTimer, cancelOpenTimer]);

  const scheduleClose = useCallback((): void => {
    cancelOpenTimer();
    cancelCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      setState(null);
    }, CLOSE_DELAY_MS);
  }, [cancelCloseTimer, cancelOpenTimer]);

  const cancelScheduledClose = useCallback((): void => {
    cancelCloseTimer();
  }, [cancelCloseTimer]);

  const close = useCallback((): void => {
    cancelOpenTimer();
    cancelCloseTimer();
    setState(null);
  }, [cancelCloseTimer, cancelOpenTimer]);

  useOnContextMenuOpened(close);

  return useMemo(() => ({
    state,
    openPreview,
    scheduleClose,
    cancelScheduledClose,
    close,
  }), [close, openPreview, scheduleClose, cancelScheduledClose, state]);
}
