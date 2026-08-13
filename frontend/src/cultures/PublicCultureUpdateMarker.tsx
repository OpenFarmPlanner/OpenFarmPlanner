/**
 * Permanent, quiet marker that the local copy differs from the current public
 * version — rendered next to the "Importiert" badge.
 *
 * The update notice disappears once the user decides (or declines), so without
 * this the diff dialog would only be reachable while an undecided update
 * exists. The marker keeps it reachable for as long as the versions differ, so
 * a rejection stays reversible without waiting for the next public edit.
 */

import { Chip } from '@mui/material';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import { useTranslation } from '../i18n';
import { AppTooltip } from '../components/AppTooltip';
import type { PublicCultureUpdateController } from './usePublicCultureUpdate';

interface PublicCultureUpdateMarkerProps {
  controller: PublicCultureUpdateController;
}

export function PublicCultureUpdateMarker({ controller }: PublicCultureUpdateMarkerProps) {
  const { t } = useTranslation('cultures');
  const { isDiverged, isRejected, isLoading, openDiff } = controller;

  if (!isDiverged) {
    return null;
  }

  const label = isRejected
    ? t('library.publicUpdate.markerRejectedLabel')
    : t('library.publicUpdate.markerLabel');
  const tooltip = isRejected
    ? t('library.publicUpdate.markerRejectedTooltip')
    : t('library.publicUpdate.markerTooltip');

  return (
    <AppTooltip title={tooltip}>
      <Chip
        size="small"
        variant="outlined"
        color="info"
        clickable
        disabled={isLoading}
        onClick={openDiff}
        icon={<SyncOutlinedIcon fontSize="small" />}
        label={label}
        data-testid="culture-public-update-marker"
      />
    </AppTooltip>
  );
}
