/**
 * Shared state for the "Aktualisierung aus der Bibliothek" diff dialog.
 *
 * The dialog has two entry points on the same crop — the update notice and
 * the permanent marker next to the "Importiert" badge — so the loading/apply/
 * reject state cannot live inside either of them. The owning page holds this
 * controller once and hands it to both.
 */

import { useCallback, useState } from 'react';
import { useTranslation } from '../i18n';
import { cropAPI, publicCropAPI } from '../api/api';
import type { Crop, CropPublicUpdate } from '../api/types';
import { showGlobalSnackbar } from '../utils/globalSnackbar';

export interface PublicCropUpdateController {
  /** The loaded diff while the dialog is open, `null` while it is closed. */
  update: CropPublicUpdate | null;
  /** An undecided library update exists — the notice should be shown. */
  hasOpenUpdate: boolean;
  /** The pending library version was explicitly declined. */
  isRejected: boolean;
  /** The copy differs from the current library version, decided or not. */
  isDiverged: boolean;
  /** The crop is linked to a public library entry at all. */
  isLinked: boolean;
  isLoading: boolean;
  isApplying: boolean;
  isRejecting: boolean;
  openDiff: () => void;
  closeDiff: () => void;
  applyUpdate: () => void;
  rejectUpdate: () => void;
}

export function usePublicCropUpdate(
  crop: Crop | null | undefined,
  onUpdated?: () => void,
): PublicCropUpdateController {
  const { t } = useTranslation(['crops', 'common']);
  const [update, setUpdate] = useState<CropPublicUpdate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const cropId = crop?.id;
  const hasOpenUpdate = Boolean(crop?.public_update_available);
  const isRejected = Boolean(crop?.public_update_rejected);
  const isLinked = Boolean(crop?.source_public_crop);

  const openDiff = useCallback((): void => {
    if (!cropId) {
      return;
    }
    setIsLoading(true);
    void cropAPI.publicUpdate(cropId)
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
  }, [cropId, onUpdated, t]);

  const closeDiff = useCallback((): void => {
    if (isApplying || isRejecting) {
      return;
    }
    setUpdate(null);
  }, [isApplying, isRejecting]);

  const applyUpdate = useCallback((): void => {
    const publicCropId = update?.public_crop_id;
    if (!publicCropId) {
      return;
    }
    setIsApplying(true);
    void publicCropAPI.importToProject(publicCropId, 'update')
      .then(() => {
        showGlobalSnackbar({
          message: t('library.publicUpdate.applied', {
            name: update?.public_crop_name ?? crop?.name ?? '',
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
  }, [crop?.name, onUpdated, t, update]);

  const rejectUpdate = useCallback((): void => {
    if (!cropId) {
      return;
    }
    setIsRejecting(true);
    void cropAPI.rejectPublicUpdate(cropId)
      .then(() => {
        showGlobalSnackbar({
          message: t('library.publicUpdate.rejected', {
            name: update?.public_crop_name ?? crop?.name ?? '',
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
  }, [crop?.name, cropId, onUpdated, t, update]);

  return {
    update,
    hasOpenUpdate,
    isRejected,
    isDiverged: hasOpenUpdate || isRejected,
    isLinked,
    isLoading,
    isApplying,
    isRejecting,
    openDiff,
    closeDiff,
    applyUpdate,
    rejectUpdate,
  };
}
