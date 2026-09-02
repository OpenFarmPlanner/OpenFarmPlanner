/**
 * Permanent, quiet marker of the sync state between a linked crop and its
 * public library entry — rendered next to the "Importiert" badge.
 *
 * The update notice disappears once the user decides (or declines), so without
 * this the diff dialog would only be reachable while an undecided update
 * exists. The marker keeps it reachable for as long as the versions differ, so
 * a rejection stays reversible without waiting for the next public edit. When
 * the copy is already in sync, the marker still renders — disabled, with a
 * tooltip explaining why — so linked crops keep a consistent, always-present
 * sync indicator instead of the control silently disappearing.
 */

import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import { useTranslation } from '../i18n';
import { AppIconChip } from '../components/AppIconChip';
import type { PublicCropUpdateController } from './usePublicCropUpdate';

interface PublicCropUpdateMarkerProps {
  controller: PublicCropUpdateController;
  /** When set, the diff stays closed and this explains why (e.g. species awaiting moderation). */
  disabledReason?: string;
}

export function PublicCropUpdateMarker({ controller, disabledReason }: PublicCropUpdateMarkerProps) {
  const { t } = useTranslation('crops');
  const { isLinked, isDiverged, isRejected, isLoading, openDiff } = controller;

  if (!isLinked) {
    return null;
  }

  const isUpToDate = !isDiverged;
  const label = isUpToDate
    ? t('library.publicUpdate.markerUpToDateLabel')
    : (isRejected
      ? t('library.publicUpdate.markerRejectedLabel')
      : t('library.publicUpdate.markerLabel'));
  const tooltip = disabledReason ?? (isUpToDate
    ? t('library.publicUpdate.markerUpToDateTooltip')
    : (isRejected
      ? t('library.publicUpdate.markerRejectedTooltip')
      : t('library.publicUpdate.markerTooltip')));
  const isDisabled = isUpToDate || isLoading || Boolean(disabledReason);

  return (
    <AppIconChip
      tooltip={tooltip}
      color="info"
      clickable={!isDisabled}
      disabled={isDisabled}
      onClick={isDisabled ? undefined : openDiff}
      icon={<SyncOutlinedIcon fontSize="small" />}
      label={label}
      data-testid="crop-public-update-marker"
    />
  );
}
