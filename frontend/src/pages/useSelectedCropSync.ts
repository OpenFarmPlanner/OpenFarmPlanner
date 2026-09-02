import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { readCropIdParam } from '../compat/legacyCropNames';
import {
  SELECTED_CROP_STORAGE_KEY,
  clearStoredCropId,
  getStoredCropId,
  parseCropId,
} from './cropsPageUtils';

type SelectionSyncSource = 'internal' | 'query' | null;
type NavigationMode = 'push' | 'replace';

type UseSelectedCropSyncResult = {
  selectedCropId: number | undefined;
  /**
   * `navigationMode` ('replace' by default) controls how the resulting URL
   * change is recorded in browser history. Regular selection (sidebar
   * browsing, filters, restoring from storage) replaces the current entry
   * so clicking through many crops doesn't turn "back" into stepping
   * through each one. Pass 'push' for a deliberate "go to this record"
   * navigation (e.g. a table row click into a variety's own page) where the
   * back button should return to the page you navigated from.
   */
  updateSelectedCropId: (
    id: number | undefined,
    source: Exclude<SelectionSyncSource, null>,
    navigationMode?: NavigationMode,
  ) => void;
};

export function useSelectedCropSync(): UseSelectedCropSyncResult {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const selectedCropParam = readCropIdParam(searchParams);
  const selectedCropIdFromQuery = parseCropId(selectedCropParam);

  const selectionSyncSourceRef = useRef<SelectionSyncSource>(null);
  const pendingNavigationModeRef = useRef<NavigationMode>('replace');
  // Whether the state->URL effect below has already run once. Its very
  // first run is special: it may need to push `selectedCropId` (seeded
  // from localStorage) into a URL that doesn't have it yet. On every later
  // run, if there's no fresh 'internal' update to reflect (ref isn't
  // 'internal'), a mismatch between the URL and this state means the *URL*
  // just changed externally (e.g. the browser back/forward buttons) and
  // hasn't been picked up by the query->state effect above yet - in that
  // case this effect must NOT overwrite the URL back to the stale state, or
  // browser back/forward would be immediately undone.
  const hasSyncedToUrlRef = useRef(false);
  const [selectedCropId, setSelectedCropId] = useState<number | undefined>(() => {
    if (Number.isFinite(selectedCropIdFromQuery)) {
      return selectedCropIdFromQuery;
    }

    return getStoredCropId();
  });

  const updateSelectedCropId = useCallback((
    id: number | undefined,
    source: Exclude<SelectionSyncSource, null>,
    navigationMode: NavigationMode = 'replace',
  ) => {
    selectionSyncSourceRef.current = source;
    pendingNavigationModeRef.current = navigationMode;
    setSelectedCropId((currentId) => (currentId === id ? currentId : id));
  }, []);

  const updateCropSearchParams = useCallback((
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

    if (selectedCropParam === null) {
      return;
    }

    if (selectedCropIdFromQuery !== selectedCropId) {
      const timeoutId = window.setTimeout(() => {
        updateSelectedCropId(selectedCropIdFromQuery, 'query');
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    return undefined;
  }, [selectedCropIdFromQuery, selectedCropId, selectedCropParam, updateSelectedCropId]);

  useEffect(() => {
    const isFirstSync = !hasSyncedToUrlRef.current;
    hasSyncedToUrlRef.current = true;
    // An external URL change (browser back/forward) this effect shouldn't
    // fight — see hasSyncedToUrlRef's comment. The very first run is exempt
    // so seeding the URL from a stored selection on load still works.
    const isExternalUrlChange = !isFirstSync && selectionSyncSourceRef.current !== 'internal';

    if (selectedCropId === undefined) {
      clearStoredCropId();

      if (selectionSyncSourceRef.current === 'query') {
        selectionSyncSourceRef.current = null;
        return;
      }

      if (!selectedCropParam || isExternalUrlChange) {
        selectionSyncSourceRef.current = null;
        return;
      }

      updateCropSearchParams((params) => {
        const nextParams = new URLSearchParams(params);
        nextParams.delete('cropId');
        return nextParams;
      }, true);
      selectionSyncSourceRef.current = null;
      pendingNavigationModeRef.current = 'replace';
      return;
    }

    localStorage.setItem(SELECTED_CROP_STORAGE_KEY, String(selectedCropId));

    if (selectionSyncSourceRef.current === 'query') {
      selectionSyncSourceRef.current = null;
      return;
    }

    if (selectedCropParam === String(selectedCropId) || isExternalUrlChange) {
      selectionSyncSourceRef.current = null;
      return;
    }

    updateCropSearchParams((params) => {
      const nextParams = new URLSearchParams(params);
      nextParams.set('cropId', String(selectedCropId));
      return nextParams;
    }, pendingNavigationModeRef.current === 'replace');
    selectionSyncSourceRef.current = null;
    pendingNavigationModeRef.current = 'replace';
  }, [updateCropSearchParams, selectedCropId, selectedCropParam]);

  return {
    selectedCropId,
    updateSelectedCropId,
  };
}
