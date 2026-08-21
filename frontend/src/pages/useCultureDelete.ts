import { useState, useRef, useCallback, useEffect } from 'react';
import type React from 'react';
import { cultureAPI, type Culture } from '../api/api';
import type { CultureDeletePreview } from '../api/types';
import { useTranslation } from '../i18n';
import { extractApiErrorMessage } from '../api/errors';
import { DELETE_UNDO_DURATION_MS } from '../components/data-grid';
import { createTransientId } from '../utils/transientId';
import { getCropSpeciesKey } from '../cultures/cropHierarchy';

export interface PendingCultureDeletion {
  id: string;
  cultureId: number;
  cultureIds: number[];
  culture: Culture;
  deletedCultures: Culture[];
  culturesBeforeDelete: Culture[];
  message: string;
  selectedCultureIdBeforeDelete?: number;
  visible: boolean;
}

export type CultureDeleteImpact = CultureDeletePreview & {
  loading: boolean;
};

interface UseCultureDeleteConfig {
  cultures: Culture[];
  setCultures: React.Dispatch<React.SetStateAction<Culture[]>>;
  selectedCultureId: number | undefined;
  updateSelectedCultureId: (id: number | undefined, source: 'internal' | 'query') => void;
  showSnackbar: (message: string, severity: 'success' | 'error' | 'info') => void;
}

export function useCultureDelete({
  cultures,
  setCultures,
  selectedCultureId,
  updateSelectedCultureId,
  showSnackbar,
}: UseCultureDeleteConfig) {
  const { t } = useTranslation(['cultures', 'common']);

  const [deleteDialogCulture, setDeleteDialogCulture] = useState<Culture | null>(null);
  const [deleteDialogImpact, setDeleteDialogImpact] = useState<CultureDeleteImpact | null>(null);
  const [pendingCultureDeletions, setPendingCultureDeletions] = useState<PendingCultureDeletion[]>([]);
  const pendingCultureDeleteTimersRef = useRef<Map<string, number>>(new Map());

  const buildLocalDeleteImpact = useCallback((culture: Culture): CultureDeleteImpact => {
    const speciesKey = getCropSpeciesKey(culture);
    const group = cultures.filter((candidate) => getCropSpeciesKey(candidate) === speciesKey);
    const hasGeneralEntry = group.some((candidate) => !(candidate.variety ?? '').trim());
    const deletesWholeGroup = !(culture.variety ?? '').trim() || !hasGeneralEntry;
    const affectedCultures = deletesWholeGroup ? group : [culture];
    const varieties = affectedCultures
      .filter((candidate) => (candidate.variety ?? '').trim())
      .map((candidate) => ({
        id: candidate.id ?? 0,
        name: (candidate.variety ?? '').trim() || candidate.name,
      }))
      .filter((candidate) => candidate.id > 0);

    return {
      culture_ids: affectedCultures
        .map((candidate) => candidate.id)
        .filter((id): id is number => typeof id === 'number'),
      varieties,
      variety_count: varieties.length,
      planning_data_count: 0,
      deletes_general_culture: !(culture.variety ?? '').trim(),
      group_without_general: Boolean((culture.variety ?? '').trim()) && !hasGeneralEntry,
      loading: true,
    };
  }, [cultures]);

  const handleDelete = (culture: Culture) => {
    setDeleteDialogCulture(culture);
    setDeleteDialogImpact(buildLocalDeleteImpact(culture));
    const cultureId = culture.id;
    if (cultureId) {
      void cultureAPI.deletePreview(cultureId)
        .then((response) => {
          setDeleteDialogImpact((currentImpact) => (
            currentImpact && currentImpact.culture_ids.includes(cultureId)
              ? { ...response.data, loading: false }
              : currentImpact
          ));
        })
        .catch((error) => {
          console.error('Error loading culture delete preview:', error);
          setDeleteDialogImpact((currentImpact) => (
            currentImpact ? { ...currentImpact, loading: false } : currentImpact
          ));
        });
    }
  };

  const removePendingCultureDeletion = useCallback((deletionId: string): void => {
    setPendingCultureDeletions((currentDeletions) =>
      currentDeletions.filter((deletion) => deletion.id !== deletionId),
    );
  }, []);

  const restorePendingCultureDeletion = useCallback((deletion: PendingCultureDeletion): void => {
    setCultures((currentCultures) => {
      if (currentCultures.some((culture) => culture.id === deletion.cultureId)) {
        return currentCultures;
      }
      const currentById = new Map<number, Culture>();
      currentCultures.forEach((culture) => {
        if (typeof culture.id === 'number') {
          currentById.set(culture.id, culture);
        }
      });
      deletion.deletedCultures.forEach((culture) => {
        if (typeof culture.id === 'number') {
          currentById.set(culture.id, culture);
        }
      });
      const restoredCultures = deletion.culturesBeforeDelete
        .map((culture) => (typeof culture.id === 'number' ? currentById.get(culture.id) : culture))
        .filter((culture): culture is Culture => Boolean(culture));
      const restoredIds = new Set(restoredCultures.map((culture) => culture.id));
      return [
        ...restoredCultures,
        ...currentCultures.filter((culture) => !restoredIds.has(culture.id)),
      ];
    });
    if (
      deletion.selectedCultureIdBeforeDelete !== undefined
      && deletion.cultureIds.includes(deletion.selectedCultureIdBeforeDelete)
    ) {
      updateSelectedCultureId(deletion.selectedCultureIdBeforeDelete, 'internal');
    }
  }, [setCultures, updateSelectedCultureId]);

  const expirePendingCultureDeletion = useCallback((deletion: PendingCultureDeletion): void => {
    pendingCultureDeleteTimersRef.current.delete(deletion.id);
    removePendingCultureDeletion(deletion.id);
  }, [removePendingCultureDeletion]);

  const undoPendingCultureDeletion = useCallback(async (deletionId: string): Promise<void> => {
    const deletion = pendingCultureDeletions.find((pendingDeletion) => pendingDeletion.id === deletionId);
    if (!deletion) {
      return;
    }

    const timerId = pendingCultureDeleteTimersRef.current.get(deletionId);
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      pendingCultureDeleteTimersRef.current.delete(deletionId);
    }

    try {
      await cultureAPI.undelete(deletion.cultureId);
      restorePendingCultureDeletion(deletion);
      removePendingCultureDeletion(deletionId);
    } catch (error) {
      console.error('Error restoring culture:', error);
      showSnackbar(extractApiErrorMessage(error, t, t('messages.restoreDeleteError')), 'error');
    }
  }, [pendingCultureDeletions, removePendingCultureDeletion, restorePendingCultureDeletion, showSnackbar, t]);

  const closePendingCultureDeletionSnackbar = useCallback((deletionId: string): void => {
    setPendingCultureDeletions((currentDeletions) =>
      currentDeletions.map((deletion) =>
        deletion.id === deletionId ? { ...deletion, visible: false } : deletion,
      ),
    );
  }, []);

  useEffect(() => {
    const pendingCultureDeleteTimers = pendingCultureDeleteTimersRef.current;
    return () => {
      pendingCultureDeleteTimers.forEach((timerId) => window.clearTimeout(timerId));
      pendingCultureDeleteTimers.clear();
    };
  }, []);

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deleteDialogCulture?.id) {
      return;
    }

    const cultureId = deleteDialogCulture.id;
    const affectedCultureIds = deleteDialogImpact?.culture_ids.length
      ? deleteDialogImpact.culture_ids
      : [cultureId];
    if (pendingCultureDeletions.some((deletion) => deletion.cultureIds.includes(cultureId))) {
      setDeleteDialogCulture(null);
      setDeleteDialogImpact(null);
      return;
    }

    const deletionId = createTransientId('culture', cultureId);
    const currentCultures = cultures;
    const deletedCultureIndex = currentCultures.findIndex((culture) => culture.id === cultureId);
    const affectedCultureIdSet = new Set(affectedCultureIds);
    const deletedCultures = currentCultures.filter((culture) => (
      typeof culture.id === 'number' && affectedCultureIdSet.has(culture.id)
    ));
    const deletionMessage = deleteDialogImpact?.group_without_general && deleteDialogImpact.variety_count > 1
      ? t('messages.varietiesDeleted')
      : (deleteDialogCulture.variety ?? '').trim()
        ? t('messages.varietyDeleted')
        : t('messages.deleted');
    const pendingDeletion: PendingCultureDeletion = {
      id: deletionId,
      cultureId,
      cultureIds: affectedCultureIds,
      culture: deleteDialogCulture,
      deletedCultures,
      culturesBeforeDelete: currentCultures,
      message: deletionMessage,
      selectedCultureIdBeforeDelete: selectedCultureId,
      visible: true,
    };

    setDeleteDialogCulture(null);
    setDeleteDialogImpact(null);

    try {
      await cultureAPI.delete(cultureId);
    } catch (error) {
      console.error('Error deleting culture:', error);
      showSnackbar(extractApiErrorMessage(error, t, t('messages.deleteError')), 'error');
      return;
    }

    setCultures((currentItems) => currentItems.filter((culture) => (
      typeof culture.id !== 'number' || !affectedCultureIdSet.has(culture.id)
    )));
    if (selectedCultureId !== undefined && affectedCultureIdSet.has(selectedCultureId)) {
      const nextSelectedCulture =
        currentCultures.slice(deletedCultureIndex + 1).find((culture) => (
          typeof culture.id !== 'number' || !affectedCultureIdSet.has(culture.id)
        )) ??
        currentCultures.slice(0, deletedCultureIndex).reverse().find((culture) => (
          typeof culture.id !== 'number' || !affectedCultureIdSet.has(culture.id)
        )) ??
        null;
      updateSelectedCultureId(nextSelectedCulture?.id, 'internal');
    }
    setPendingCultureDeletions((currentDeletions) => [...currentDeletions, pendingDeletion]);

    const timerId = window.setTimeout(() => {
      expirePendingCultureDeletion(pendingDeletion);
    }, DELETE_UNDO_DURATION_MS);
    pendingCultureDeleteTimersRef.current.set(deletionId, timerId);
  };

  return {
    deleteDialogCulture,
    deleteDialogImpact,
    setDeleteDialogCulture,
    setDeleteDialogImpact,
    pendingCultureDeletions,
    handleDelete,
    handleDeleteConfirm,
    undoPendingCultureDeletion,
    closePendingCultureDeletionSnackbar,
  };
}
