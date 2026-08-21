import { useState, useRef, useCallback, useEffect } from 'react';
import type React from 'react';
import { cultureAPI, type Culture } from '../api/api';
import { useTranslation } from '../i18n';
import { extractApiErrorMessage } from '../api/errors';
import { DELETE_UNDO_DURATION_MS } from '../components/data-grid';
import { createTransientId } from '../utils/transientId';

export interface PendingCultureDeletion {
  id: string;
  cultureId: number;
  culture: Culture;
  culturesBeforeDelete: Culture[];
  message: string;
  selectedCultureIdBeforeDelete?: number;
  visible: boolean;
}

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
  const [pendingCultureDeletions, setPendingCultureDeletions] = useState<PendingCultureDeletion[]>([]);
  const pendingCultureDeleteTimersRef = useRef<Map<string, number>>(new Map());

  const handleDelete = (culture: Culture) => {
    setDeleteDialogCulture(culture);
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
      currentById.set(deletion.cultureId, deletion.culture);
      const restoredCultures = deletion.culturesBeforeDelete
        .map((culture) => (typeof culture.id === 'number' ? currentById.get(culture.id) : culture))
        .filter((culture): culture is Culture => Boolean(culture));
      const restoredIds = new Set(restoredCultures.map((culture) => culture.id));
      return [
        ...restoredCultures,
        ...currentCultures.filter((culture) => !restoredIds.has(culture.id)),
      ];
    });
    if (deletion.selectedCultureIdBeforeDelete === deletion.cultureId) {
      updateSelectedCultureId(deletion.cultureId, 'internal');
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
    if (pendingCultureDeletions.some((deletion) => deletion.cultureId === cultureId)) {
      setDeleteDialogCulture(null);
      return;
    }

    const deletionId = createTransientId('culture', cultureId);
    const currentCultures = cultures;
    const deletedCultureIndex = currentCultures.findIndex((culture) => culture.id === cultureId);
    const pendingDeletion: PendingCultureDeletion = {
      id: deletionId,
      cultureId,
      culture: deleteDialogCulture,
      culturesBeforeDelete: currentCultures,
      message: (deleteDialogCulture.variety ?? '').trim()
        ? t('messages.varietyDeleted')
        : t('messages.deleted'),
      selectedCultureIdBeforeDelete: selectedCultureId,
      visible: true,
    };

    setDeleteDialogCulture(null);

    try {
      await cultureAPI.delete(cultureId);
    } catch (error) {
      console.error('Error deleting culture:', error);
      showSnackbar(extractApiErrorMessage(error, t, t('messages.deleteError')), 'error');
      return;
    }

    setCultures((currentItems) => currentItems.filter((culture) => culture.id !== cultureId));
    if (selectedCultureId === cultureId) {
      const nextSelectedCulture =
        currentCultures[deletedCultureIndex + 1] ??
        currentCultures[deletedCultureIndex - 1] ??
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
    setDeleteDialogCulture,
    pendingCultureDeletions,
    handleDelete,
    handleDeleteConfirm,
    undoPendingCultureDeletion,
    closePendingCultureDeletionSnackbar,
  };
}
