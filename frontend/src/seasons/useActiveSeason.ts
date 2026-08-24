import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { seasonAPI } from '../api/api';
import type { Season, SeasonDueSuggestion } from '../api/types';
import { extractApiErrorMessage } from '../api/errors';
import { useTranslation } from '../i18n';
import { useAuth } from '../auth/useAuth';
import { createTransientId } from '../utils/transientId';
import { DELETE_UNDO_DURATION_MS } from '../components/data-grid';
import {
  clearStoredActiveSeasonId,
  getStoredActiveSeasonId,
  setStoredActiveSeasonId,
} from './activeSeasonStorage';

export interface PendingSeasonDeletion {
  id: string;
  seasonId: number;
  message: string;
  visible: boolean;
}

export function useActiveSeason() {
  const { t } = useTranslation(['navigation', 'common']);
  const { activeProjectId } = useAuth();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dueSuggestion, setDueSuggestion] = useState<SeasonDueSuggestion | null>(null);
  const [pendingDeletions, setPendingDeletions] = useState<PendingSeasonDeletion[]>([]);
  const pendingDeleteTimersRef = useRef<Map<string, number>>(new Map());

  const activeSeasonId = activeProjectId ? getStoredActiveSeasonId(activeProjectId) : null;

  const activeSeason = useMemo<Season | null>(() => {
    if (seasons.length === 0) {
      return null;
    }
    const stored = seasons.find((season) => season.id === activeSeasonId);
    // Newest season (seasons are ordered start_date desc) if the stored id is
    // missing, stale, or has never been set.
    return stored ?? seasons[0];
  }, [seasons, activeSeasonId]);

  const reload = useCallback(async () => {
    if (!activeProjectId) {
      setSeasons([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [seasonsResponse, dueResponse] = await Promise.all([
        seasonAPI.list(),
        seasonAPI.dueSuggestion(),
      ]);
      setSeasons(seasonsResponse.data.results);
      setDueSuggestion(dueResponse.data);
    } catch (loadError) {
      setError(extractApiErrorMessage(loadError, t, t('navigation:seasonSwitcher.loadError')));
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // A season switch changes what every planting-plan-backed page shows —
  // reload the app the same deliberate way a project switch does (see
  // AuthContext.switchActiveProject) rather than trying to invalidate every
  // page's in-flight state individually.
  const switchSeason = useCallback((seasonId: number) => {
    if (!activeProjectId) {
      return;
    }
    setStoredActiveSeasonId(activeProjectId, seasonId);
    window.location.reload();
  }, [activeProjectId]);

  const createSeason = useCallback(async (
    startDate: string,
    endDate: string,
    copyFromSeasonId?: number,
  ): Promise<Season> => {
    const response = await seasonAPI.create({ start_date: startDate, end_date: endDate });
    const created = response.data;
    if (copyFromSeasonId) {
      await seasonAPI.copyFrom(created.id, copyFromSeasonId);
    }
    await reload();
    return created;
  }, [reload]);

  const renameSeason = useCallback(async (seasonId: number, customLabel: string): Promise<void> => {
    await seasonAPI.update(seasonId, { custom_label: customLabel });
    await reload();
  }, [reload]);

  const copyDataInto = useCallback(async (targetSeasonId: number, sourceSeasonId: number) => {
    const response = await seasonAPI.copyFrom(targetSeasonId, sourceSeasonId);
    await reload();
    return response.data;
  }, [reload]);

  const removePendingDeletion = useCallback((deletionId: string) => {
    setPendingDeletions((current) => current.filter((deletion) => deletion.id !== deletionId));
  }, []);

  const expirePendingDeletion = useCallback((deletionId: string) => {
    pendingDeleteTimersRef.current.delete(deletionId);
    removePendingDeletion(deletionId);
  }, [removePendingDeletion]);

  const deleteSeason = useCallback(async (season: Season): Promise<void> => {
    await seasonAPI.delete(season.id);
    if (activeProjectId && activeSeasonId === season.id) {
      clearStoredActiveSeasonId(activeProjectId);
    }
    await reload();

    const deletionId = createTransientId('season', season.id);
    setPendingDeletions((current) => [...current, {
      id: deletionId,
      seasonId: season.id,
      message: t('navigation:seasonSwitcher.deleted', { label: season.label }),
      visible: true,
    }]);
    const timerId = window.setTimeout(() => expirePendingDeletion(deletionId), DELETE_UNDO_DURATION_MS);
    pendingDeleteTimersRef.current.set(deletionId, timerId);
  }, [activeProjectId, activeSeasonId, expirePendingDeletion, reload, t]);

  const undoPendingDeletion = useCallback(async (deletionId: string): Promise<void> => {
    const deletion = pendingDeletions.find((pending) => pending.id === deletionId);
    if (!deletion) {
      return;
    }
    const timerId = pendingDeleteTimersRef.current.get(deletionId);
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      pendingDeleteTimersRef.current.delete(deletionId);
    }
    await seasonAPI.undelete(deletion.seasonId);
    removePendingDeletion(deletionId);
    await reload();
  }, [pendingDeletions, removePendingDeletion, reload]);

  const closePendingDeletionSnackbar = useCallback((deletionId: string) => {
    setPendingDeletions((current) => current.map((deletion) => (
      deletion.id === deletionId ? { ...deletion, visible: false } : deletion
    )));
  }, []);

  useEffect(() => {
    const timers = pendingDeleteTimersRef.current;
    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
      timers.clear();
    };
  }, []);

  return {
    seasons,
    activeSeason,
    loading,
    error,
    dueSuggestion,
    pendingDeletions,
    reload,
    switchSeason,
    createSeason,
    renameSeason,
    copyDataInto,
    deleteSeason,
    undoPendingDeletion,
    closePendingDeletionSnackbar,
  };
}

export type UseActiveSeasonReturn = ReturnType<typeof useActiveSeason>;
