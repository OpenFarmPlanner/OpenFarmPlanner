import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  SELECTED_CULTURE_STORAGE_KEY,
  getStoredCultureId,
  parseCultureId,
} from './culturesPageUtils';

type SelectionSyncSource = 'internal' | 'query' | null;
type NavigationMode = 'push' | 'replace';

type UseSelectedCultureSyncResult = {
  selectedCultureId: number | undefined;
  /**
   * `navigationMode` ('replace' by default) controls how the resulting URL
   * change is recorded in browser history. Regular selection (sidebar
   * browsing, filters, restoring from storage) replaces the current entry
   * so clicking through many cultures doesn't turn "back" into stepping
   * through each one. Pass 'push' for a deliberate "go to this record"
   * navigation (e.g. a table row click into a variety's own page) where the
   * back button should return to the page you navigated from.
   */
  updateSelectedCultureId: (
    id: number | undefined,
    source: Exclude<SelectionSyncSource, null>,
    navigationMode?: NavigationMode,
  ) => void;
};

export function useSelectedCultureSync(): UseSelectedCultureSyncResult {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const selectedCultureParam = searchParams.get('cultureId');
  const selectedCultureIdFromQuery = parseCultureId(selectedCultureParam);

  const selectionSyncSourceRef = useRef<SelectionSyncSource>(null);
  const pendingNavigationModeRef = useRef<NavigationMode>('replace');
  // Whether the state->URL effect below has already run once. Its very
  // first run is special: it may need to push `selectedCultureId` (seeded
  // from localStorage) into a URL that doesn't have it yet. On every later
  // run, if there's no fresh 'internal' update to reflect (ref isn't
  // 'internal'), a mismatch between the URL and this state means the *URL*
  // just changed externally (e.g. the browser back/forward buttons) and
  // hasn't been picked up by the query->state effect above yet - in that
  // case this effect must NOT overwrite the URL back to the stale state, or
  // browser back/forward would be immediately undone.
  const hasSyncedToUrlRef = useRef(false);
  const [selectedCultureId, setSelectedCultureId] = useState<number | undefined>(() => {
    if (Number.isFinite(selectedCultureIdFromQuery)) {
      return selectedCultureIdFromQuery;
    }

    return getStoredCultureId();
  });

  const updateSelectedCultureId = useCallback((
    id: number | undefined,
    source: Exclude<SelectionSyncSource, null>,
    navigationMode: NavigationMode = 'replace',
  ) => {
    selectionSyncSourceRef.current = source;
    pendingNavigationModeRef.current = navigationMode;
    setSelectedCultureId((currentId) => (currentId === id ? currentId : id));
  }, []);

  const updateCultureSearchParams = useCallback((
    updateParams: (params: URLSearchParams) => URLSearchParams,
    replace: boolean,
  ): void => {
    const browserPathname = window.location.pathname;
    if (browserPathname.includes('/app/') && !browserPathname.endsWith(location.pathname)) {
      return;
    }

    const nextParams = updateParams(new URLSearchParams(location.search));
    const nextSearch = nextParams.toString();
    const currentSearch = location.search.startsWith('?') ? location.search.slice(1) : location.search;

    if (nextSearch === currentSearch) {
      return;
    }

    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
        hash: location.hash,
      },
      { replace },
    );
  }, [location.hash, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (selectionSyncSourceRef.current === 'internal') {
      return;
    }

    if (selectedCultureParam === null) {
      return;
    }

    if (selectedCultureIdFromQuery !== selectedCultureId) {
      const timeoutId = window.setTimeout(() => {
        updateSelectedCultureId(selectedCultureIdFromQuery, 'query');
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    return undefined;
  }, [selectedCultureIdFromQuery, selectedCultureId, selectedCultureParam, updateSelectedCultureId]);

  useEffect(() => {
    const isFirstSync = !hasSyncedToUrlRef.current;
    hasSyncedToUrlRef.current = true;
    // An external URL change (browser back/forward) this effect shouldn't
    // fight — see hasSyncedToUrlRef's comment. The very first run is exempt
    // so seeding the URL from a stored selection on load still works.
    const isExternalUrlChange = !isFirstSync && selectionSyncSourceRef.current !== 'internal';

    if (selectedCultureId === undefined) {
      localStorage.removeItem(SELECTED_CULTURE_STORAGE_KEY);

      if (selectionSyncSourceRef.current === 'query') {
        selectionSyncSourceRef.current = null;
        return;
      }

      if (!selectedCultureParam || isExternalUrlChange) {
        selectionSyncSourceRef.current = null;
        return;
      }

      updateCultureSearchParams((params) => {
        const nextParams = new URLSearchParams(params);
        nextParams.delete('cultureId');
        return nextParams;
      }, true);
      selectionSyncSourceRef.current = null;
      pendingNavigationModeRef.current = 'replace';
      return;
    }

    localStorage.setItem(SELECTED_CULTURE_STORAGE_KEY, String(selectedCultureId));

    if (selectionSyncSourceRef.current === 'query') {
      selectionSyncSourceRef.current = null;
      return;
    }

    if (selectedCultureParam === String(selectedCultureId) || isExternalUrlChange) {
      selectionSyncSourceRef.current = null;
      return;
    }

    updateCultureSearchParams((params) => {
      const nextParams = new URLSearchParams(params);
      nextParams.set('cultureId', String(selectedCultureId));
      return nextParams;
    }, pendingNavigationModeRef.current === 'replace');
    selectionSyncSourceRef.current = null;
    pendingNavigationModeRef.current = 'replace';
  }, [updateCultureSearchParams, selectedCultureId, selectedCultureParam]);

  return {
    selectedCultureId,
    updateSelectedCultureId,
  };
}
