import { Box, Chip } from '@mui/material';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import { AppTooltip } from '../components/AppTooltip';
import { useTranslation } from '../i18n';

interface CropSpeciesPendingChipProps {
  /**
   * Icon-only rendering for tight rows (the crop list is 230px wide on `md`,
   * where a labelled chip would push the crop name out). The label still
   * reaches assistive tech and hover/touch through `aria-label` and tooltip.
   */
  iconOnly?: boolean;
}

/**
 * "Vorschlag in Prüfung" — shown wherever a crop species that a user proposed
 * is visible before a moderator has decided on it, both in the public library
 * and on the proposer's own variety. Everything published under such a species
 * is real but provisional, and import/update/discussion stay disabled until
 * the review happens (see `isCropSpeciesPending`).
 */
export function CropSpeciesPendingChip({ iconOnly = false }: CropSpeciesPendingChipProps) {
  const { t } = useTranslation('cultures');
  const label = t('library.badges.speciesPendingChip');

  if (iconOnly) {
    return (
      <AppTooltip title={t('library.badges.speciesPendingChipTooltip')}>
        <Box
          component="span"
          aria-label={label}
          sx={{ display: 'inline-flex', color: 'warning.main', flexShrink: 0, ml: 0.5 }}
        >
          <HourglassEmptyOutlinedIcon fontSize="small" />
        </Box>
      </AppTooltip>
    );
  }

  return (
    <AppTooltip title={t('library.badges.speciesPendingChipTooltip')}>
      <Chip
        size="small"
        color="warning"
        variant="outlined"
        icon={<HourglassEmptyOutlinedIcon fontSize="small" />}
        label={label}
      />
    </AppTooltip>
  );
}
