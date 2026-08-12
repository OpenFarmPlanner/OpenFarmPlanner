/**
 * Shared state for the "Aktualisierung aus der Bibliothek" diff dialog.
 *
 * The dialog has two entry points on the same culture — the update notice and
 * the permanent marker next to the "Importiert" badge — so the loading/apply/
 * reject state cannot live inside either of them. The owning page holds this
 * controller once and hands it to both.
 */

import { useCallback, useState } from 'react';
import { useTranslation } from '../i18n';
import { cultureAPI, publicCultureAPI } from '../api/api';
import type { Culture, CulturePublicUpdate } from '../api/types';
import { showGlobalSnackbar } from '../utils/globalSnackbar';

export interface PublicCultureUpdateController {
  /** The loaded diff while the dialog is open, `null` while it is closed. */
  update: CulturePublicUpdate | null;
  /** An undecided library update exists — the notice should be shown. */
  hasOpenUpdate: boolean;
  /** The pending library version was explicitly declined. */
  isRejected: boolean;
  /** The copy differs from the current library version, decided or not. */
  isDiverged: boolean;
  isLoading: boolean;
  isApplying: boolean;
  isRejecting: boolean;
  openDiff: () => void;
  closeDiff: () => void;
  applyUpdate: () => void;
  rejectUpdate: () => void;
}

export function usePublicCultureUpdate(
  culture: Culture | null | undefined,
  onUpdated?: () => void,
): PublicCultureUpdateController {
  const { t } = useTranslation(['cultures', 'common']);
  const [update, setUpdate] = useState<CulturePublicUpdate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const cultureId = culture?.id;
  const hasOpenUpdate = Boolean(culture?.public_update_available);
  const isRejected = Boolean(culture?.public_update_rejected);

  const openDiff = useCallback((): void => {
    if (!cultureId) {
      return;
    }
    setIsLoading(true);
    void cultureAPI.publicUpdate(cultureId)
      .then((response) => {
        if (!response.data.available) {
          // The entry moved on (or back) between the list load and this click.
          showGlobalSnackbar({ message: t('library.publicUpdate.gone'), severity: 'info' });
          onUpdated?.();
          return;
        }
        setUpdate(response.data);
      })
      .catch(() => {
        showGlobalSnackbar({ message: t('library.publicUpdate.loadError'), severity: 'error' });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [cultureId, onUpdated, t]);

  const closeDiff = useCallback((): void => {
    if (isApplying || isRejecting) {
      return;
    }
    setUpdate(null);
  }, [isApplying, isRejecting]);

  const applyUpdate = useCallback((): void => {
    const publicCultureId = update?.public_culture_id;
    if (!publicCultureId) {
      return;
    }
    setIsApplying(true);
    void publicCultureAPI.importToProject(publicCultureId, 'update')
      .then(() => {
        showGlobalSnackbar({
          message: t('library.publicUpdate.applied', {
            name: update?.public_culture_name ?? culture?.name ?? '',
          }),
          severity: 'success',
        });
        setUpdate(null);
        onUpdated?.();
      })
      .catch(() => {
        showGlobalSnackbar({ message: t('library.publicUpdate.applyError'), severity: 'error' });
      })
      .finally(() => {
        setIsApplying(false);
      });
  }, [culture?.name, onUpdated, t, update]);

  const rejectUpdate = useCallback((): void => {
    if (!cultureId) {
      return;
    }
    setIsRejecting(true);
    void cultureAPI.rejectPublicUpdate(cultureId)
      .then(() => {
        showGlobalSnackbar({
          message: t('library.publicUpdate.rejected', {
            name: update?.public_culture_name ?? culture?.name ?? '',
          }),
          severity: 'info',
        });
        setUpdate(null);
        onUpdated?.();
      })
      .catch(() => {
        showGlobalSnackbar({ message: t('library.publicUpdate.rejectError'), severity: 'error' });
      })
      .finally(() => {
        setIsRejecting(false);
      });
  }, [culture?.name, cultureId, onUpdated, t, update]);

  return {
    update,
    hasOpenUpdate,
    isRejected,
    isDiverged: hasOpenUpdate || isRejected,
    isLoading,
    isApplying,
    isRejecting,
    openDiff,
    closeDiff,
    applyUpdate,
    rejectUpdate,
  };
}
