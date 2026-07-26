/**
 * Custom hook for managing hierarchical data fetching
 */

import { useState, useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from '../../../i18n';
import { locationAPI, fieldAPI, bedAPI, type Location, type Field, type Bed } from '../../../api/api';

type HierarchyEntity = {
  id?: number | null;
};

interface FetchDataOptions {
  showLoading?: boolean;
}

const hasTemporaryEntityId = (entity: HierarchyEntity): boolean =>
  typeof entity.id === 'number' && entity.id < 0;

const mergePersistedWithTemporaryEntities = <T extends HierarchyEntity>(
  persistedEntities: T[],
  currentEntities: T[],
): T[] => {
  const temporaryEntities = currentEntities.filter(hasTemporaryEntityId);
  return [...temporaryEntities, ...persistedEntities];
};

export interface HierarchyDataState {
  loading: boolean;
  hasLoaded: boolean;
  error: string;
  setError: Dispatch<SetStateAction<string>>;
  locations: Location[];
  setLocations: Dispatch<SetStateAction<Location[]>>;
  fields: Field[];
  setFields: Dispatch<SetStateAction<Field[]>>;
  beds: Bed[];
  setBeds: Dispatch<SetStateAction<Bed[]>>;
  fetchData: (options?: FetchDataOptions) => Promise<void>;
  /**
   * Increments only after a foreground fetch (initial load, or a caller
   * explicitly requesting `showLoading: true`) finishes applying its data —
   * unlike the silent `showLoading: false` background refetch after a
   * create/rename. Consumers that need to know "the table was freshly
   * (re)loaded" (e.g. to refresh a stable sort-order snapshot) should watch
   * this instead of `loading`/`hasLoaded`, which don't distinguish the two.
   */
  fetchGeneration: number;
}

export function useHierarchyData(enabled = true): HierarchyDataState {
  const { t } = useTranslation('hierarchy');
  const [loading, setLoading] = useState<boolean>(enabled);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [fetchGeneration, setFetchGeneration] = useState(0);
  const latestFetchRequestRef = useRef(0);

  const fetchData = useCallback(async (options: FetchDataOptions = {}): Promise<void> => {
    if (!enabled) {
      return;
    }
    const { showLoading = true } = options;
    const fetchRequestId = latestFetchRequestRef.current + 1;
    latestFetchRequestRef.current = fetchRequestId;
    if (showLoading) {
      setLoading(true);
    }
    try {
      // listAll (not list) — list() is capped at the backend's default page
      // size (100), which silently truncated large projects (more than 100
      // fields or beds) to their first page, making the tail of the
      // hierarchy tree unreachable no matter how the table itself scrolled.
      const [locationsRes, fieldsRes, bedsRes] = await Promise.all([
        locationAPI.listAll(),
        fieldAPI.listAll(),
        bedAPI.listAll(),
      ]);

      if (fetchRequestId !== latestFetchRequestRef.current) {
        return;
      }
      
      const locs = locationsRes.results.filter(l => l.id !== undefined);
      const flds = fieldsRes.results.filter(f => f.id !== undefined);
      const bds = bedsRes.results.filter(b => b.id !== undefined);
      setLocations((currentLocations) =>
        mergePersistedWithTemporaryEntities(locs, currentLocations),
      );
      setFields((currentFields) =>
        mergePersistedWithTemporaryEntities(flds, currentFields),
      );
      setBeds((currentBeds) =>
        mergePersistedWithTemporaryEntities(bds, currentBeds),
      );
      setError('');
      if (showLoading) {
        setFetchGeneration((generation) => generation + 1);
      }
    } catch (err) {
      if (fetchRequestId !== latestFetchRequestRef.current) {
        return;
      }
      setError(t('errors.load'));
      console.error('Error fetching data:', err);
    } finally {
      if (fetchRequestId !== latestFetchRequestRef.current) {
        return;
      }
      setHasLoaded(true);
      setLoading(false);
    }
  }, [enabled, t]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setHasLoaded(false);
      setError('');
      setLocations([]);
      setFields([]);
      setBeds([]);
      return;
    }

    void fetchData();
  }, [enabled, fetchData]);

  return {
    loading,
    hasLoaded,
    error,
    setError,
    locations,
    setLocations,
    fields,
    beds,
    setBeds,
    setFields,
    fetchData,
    fetchGeneration,
  };
}
