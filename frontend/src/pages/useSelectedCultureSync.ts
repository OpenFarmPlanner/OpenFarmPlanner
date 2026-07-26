import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import {
  SELECTED_CULTURE_STORAGE_KEY,
  getStoredCultureId,
  parseCultureId,
} from './culturesPageUtils';

type SelectionSyncSource = 'internal' | 'query' | null;

type UseSelectedCultureSyncResult = {
  selectedCultureId: number | undefined;
  updateSelectedCultureId: (id: number | undefined, source: Exclude<SelectionSyncSource, null>) => void;
};

export function useSelectedCultureSync(): UseSelectedCultureSyncResult {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const selectedCultureParam = searchParams.get('cultureId');
  const selectedCultureIdFromQuery = parseCultureId(selectedCultureParam);

  const selectionSyncSourceRef = useRef<SelectionSyncSource>(null);
  const [selectedCultureId, setSelectedCultureId] = useState<number | undefined>(() => {
    if (Number.isFinite(selectedCultureIdFromQuery)) {
      return selectedCultureIdFromQuery;
    }

    return getStoredCultureId();
  });

  const updateSelectedCultureId = useCallback((id: number | undefined, source: Exclude<SelectionSyncSource, null>) => {
    selectionSyncSourceRef.current = source;
    setSelectedCultureId((currentId) => (currentId === id ? currentId : id));
  }, []);

  const replaceCultureSearchParams = useCallback((updateParams: (params: URLSearchParams) => URLSearchParams): void => {
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
      { replace: true },
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
    if (selectedCultureId === undefined) {
      localStorage.removeItem(SELECTED_CULTURE_STORAGE_KEY);

      if (selectionSyncSourceRef.current === 'query') {
        selectionSyncSourceRef.current = null;
        return;
      }

      if (!selectedCultureParam) {
        selectionSyncSourceRef.current = null;
        return;
      }

      replaceCultureSearchParams((params) => {
        const nextParams = new URLSearchParams(params);
        nextParams.delete('cultureId');
        return nextParams;
      });
      selectionSyncSourceRef.current = null;
      return;
    }

    localStorage.setItem(SELECTED_CULTURE_STORAGE_KEY, String(selectedCultureId));

    if (selectionSyncSourceRef.current === 'query') {
      selectionSyncSourceRef.current = null;
      return;
    }

    if (selectedCultureParam === String(selectedCultureId)) {
      selectionSyncSourceRef.current = null;
      return;
    }

    replaceCultureSearchParams((params) => {
      const nextParams = new URLSearchParams(params);
      nextParams.set('cultureId', String(selectedCultureId));
      return nextParams;
    });
    selectionSyncSourceRef.current = null;
  }, [replaceCultureSearchParams, selectedCultureId, selectedCultureParam]);

  return {
    selectedCultureId,
    updateSelectedCultureId,
  };
}
