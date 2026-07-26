import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';
import { AuthContext } from '../../auth/authContextShared';
import { useIsCoarsePointer } from '../../utils/contextMenu';

export const CONTEXT_MENU_HINT_STORAGE_KEY = 'ofp.contextMenuHintDismissed';
const CONTEXT_MENU_HINT_STORAGE_EVENT = 'ofp:context-menu-hint-dismissed';
/** Suffix distinguishing the touch (long-press) hint's dismissal from the
 * desktop (right-click) hint's — see the "independent per input mode"
 * requirement in the class doc below. */
const TOUCH_STORAGE_KEY_SUFFIX = ':touch';

interface UseContextMenuHintOptions {
  contextKey: string;
  enabled?: boolean;
  isDesktop?: boolean;
  /** Override for touch-pointer detection — mainly for tests. Defaults to `(pointer: coarse)`. */
  isTouch?: boolean;
  isLoading?: boolean;
  hasRows?: boolean;
}

interface UseContextMenuHintResult {
  /** Desktop (fine-pointer) right-click hint — unchanged from before the touch hint existed. */
  showContextMenuHint: boolean;
  closeContextMenuHint: () => void;
  markContextMenuHintUsed: () => void;
  /** Touch (coarse-pointer) long-press hint — dismissal state is entirely
   * independent of the desktop hint above, per-table, per-user. */
  showTouchContextMenuHint: boolean;
  closeTouchContextMenuHint: () => void;
  markTouchContextMenuHintUsed: () => void;
}

interface ShouldShowContextMenuHintOptions {
  isDesktop: boolean;
  isLoading: boolean;
  hasRows: boolean;
  hasDismissedHint: boolean;
}

export function shouldShowContextMenuHint({
  isDesktop,
  isLoading,
  hasRows,
  hasDismissedHint,
}: ShouldShowContextMenuHintOptions): boolean {
  return isDesktop && !isLoading && hasRows && !hasDismissedHint;
}

/** Same gating logic as `shouldShowContextMenuHint`, keyed on touch instead of desktop. */
export function shouldShowTouchContextMenuHint({
  isTouch,
  isLoading,
  hasRows,
  hasDismissedHint,
}: {
  isTouch: boolean;
  isLoading: boolean;
  hasRows: boolean;
  hasDismissedHint: boolean;
}): boolean {
  return isTouch && !isLoading && hasRows && !hasDismissedHint;
}

function normalizeContextMenuHintKey(contextKey: string): string {
  const normalizedContextKey = contextKey.trim();
  return normalizedContextKey.length > 0 ? normalizedContextKey : 'default';
}

function getContextMenuHintStorageKey(
  contextKey: string,
  userId?: number | null,
  variant: 'desktop' | 'touch' = 'desktop',
): string {
  const normalizedContextKey = normalizeContextMenuHintKey(contextKey);
  const suffix = variant === 'touch' ? TOUCH_STORAGE_KEY_SUFFIX : '';

  if (userId !== undefined && userId !== null) {
    return `${CONTEXT_MENU_HINT_STORAGE_KEY}:user:${userId}:context:${normalizedContextKey}${suffix}`;
  }

  return `${CONTEXT_MENU_HINT_STORAGE_KEY}:context:${normalizedContextKey}${suffix}`;
}

function hasStoredContextMenuHintDismissal(storageKey: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  if (window.localStorage.getItem(storageKey) === '1') {
    return true;
  }

  return false;
}

function storeContextMenuHintDismissal(storageKey: string, notifyCurrentPage = true): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(storageKey, '1');
  if (notifyCurrentPage) {
    window.dispatchEvent(new Event(CONTEXT_MENU_HINT_STORAGE_EVENT));
  }
}

export function clearContextMenuHintDismissals(userId?: number | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  const removableKeys = new Set<string>([CONTEXT_MENU_HINT_STORAGE_KEY]);
  const contextPrefixes = [
    `${CONTEXT_MENU_HINT_STORAGE_KEY}:context:`,
    `${CONTEXT_MENU_HINT_STORAGE_KEY}:project:`,
  ];

  if (userId !== undefined && userId !== null) {
    removableKeys.add(`${CONTEXT_MENU_HINT_STORAGE_KEY}:user:${userId}`);
    contextPrefixes.push(`${CONTEXT_MENU_HINT_STORAGE_KEY}:user:${userId}:context:`);
  }

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) {
      continue;
    }
    if (contextPrefixes.some((prefix) => key.startsWith(prefix))) {
      removableKeys.add(key);
    }
  }

  removableKeys.forEach((key) => window.localStorage.removeItem(key));
  window.dispatchEvent(new Event(CONTEXT_MENU_HINT_STORAGE_EVENT));
}

/**
 * One dismissible hint's storage-backed state, for one input-mode variant.
 *
 * `markUsed()` (desktop right-click, or touch long press) persists the
 * dismissal to storage but deliberately does *not* hide the banner in the
 * current session for either variant — matching the existing, tested
 * desktop contract: the menu the interaction opens already overlays the
 * hint, and the banner only actually disappears on the next load/remount
 * that re-reads storage. Only the explicit close button (`close()`) hides
 * it immediately.
 */
function useHintDismissal(storageKey: string): {
  hasDismissedHint: boolean;
  markUsed: () => void;
  close: () => void;
} {
  const [hasDismissedHint, setHasDismissedHint] = useState(() => hasStoredContextMenuHintDismissal(storageKey));

  useEffect(() => {
    const syncDismissalState = (): void => {
      setHasDismissedHint(hasStoredContextMenuHintDismissal(storageKey));
    };

    syncDismissalState();
    window.addEventListener('storage', syncDismissalState);
    window.addEventListener(CONTEXT_MENU_HINT_STORAGE_EVENT, syncDismissalState);
    return () => {
      window.removeEventListener('storage', syncDismissalState);
      window.removeEventListener(CONTEXT_MENU_HINT_STORAGE_EVENT, syncDismissalState);
    };
  }, [storageKey]);

  const markUsed = useCallback((): void => {
    storeContextMenuHintDismissal(storageKey, false);
  }, [storageKey]);

  const close = useCallback((): void => {
    storeContextMenuHintDismissal(storageKey);
    setHasDismissedHint(true);
  }, [storageKey]);

  return { hasDismissedHint, markUsed, close };
}

export function useContextMenuHint({
  contextKey,
  enabled = true,
  isDesktop,
  isTouch,
  isLoading = false,
  hasRows,
}: UseContextMenuHintOptions): UseContextMenuHintResult {
  const authContext = useContext(AuthContext);
  const userId = authContext?.user?.id;
  const desktopStorageKey = useMemo(
    () => getContextMenuHintStorageKey(contextKey, userId, 'desktop'),
    [userId, contextKey],
  );
  const touchStorageKey = useMemo(
    () => getContextMenuHintStorageKey(contextKey, userId, 'touch'),
    [userId, contextKey],
  );
  const desktop = useHintDismissal(desktopStorageKey);
  const touch = useHintDismissal(touchStorageKey);

  const isDesktopPointer = useMediaQuery('(pointer: fine) and (min-width:901px)');
  const isCoarsePointer = useIsCoarsePointer();
  const resolvedIsDesktop = isDesktop ?? isDesktopPointer;
  const resolvedIsTouch = isTouch ?? isCoarsePointer;
  const resolvedHasRows = hasRows ?? enabled;

  const showContextMenuHint = enabled && shouldShowContextMenuHint({
    isDesktop: resolvedIsDesktop,
    isLoading,
    hasRows: resolvedHasRows,
    hasDismissedHint: desktop.hasDismissedHint,
  });
  const showTouchContextMenuHint = enabled && shouldShowTouchContextMenuHint({
    isTouch: resolvedIsTouch,
    isLoading,
    hasRows: resolvedHasRows,
    hasDismissedHint: touch.hasDismissedHint,
  });

  return {
    showContextMenuHint,
    closeContextMenuHint: desktop.close,
    markContextMenuHintUsed: desktop.markUsed,
    showTouchContextMenuHint,
    closeTouchContextMenuHint: touch.close,
    markTouchContextMenuHintUsed: touch.markUsed,
  };
}
