import { Box, Typography } from '@mui/material';
import type { Culture } from '../api/types';
import { useTranslation } from '../i18n';
import { resolveLocaleFromLanguage } from '../utils/numberLocalization';
import { getComparisonCellValue, getVaryingComparisonFields } from './varietyComparisonFields';

interface SoleVarietyDifferenceSummaryProps {
  variety: Culture;
  cropCulture: Culture;
}

const summaryGridSx = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, minmax(180px, 1fr))',
    lg: 'repeat(3, minmax(180px, 1fr))',
  },
  gap: 2,
} as const;

/**
 * Compact "variety vs. general crop" summary shown in the Varieties card
 * when there's exactly one variety — there's no other variety to compare
 * against for the full comparison table, so this diffs the sole variety's
 * effective values directly against the crop's instead. Reuses the same
 * comparison logic as the table by treating the crop as a second "variety"
 * in the comparison: since `getVaryingComparisonFields`/`getComparisonCellValue`
 * resolve each culture's effective value against the given crop baseline,
 * passing the crop itself as one of the compared cultures makes its
 * "effective value" just its own raw value — exactly the baseline to diff
 * the real variety against.
 */
export function SoleVarietyDifferenceSummary({ variety, cropCulture }: SoleVarietyDifferenceSummaryProps) {
  const { t, i18n } = useTranslation('cultures');
  const locale = resolveLocaleFromLanguage(i18n.resolvedLanguage ?? i18n.language);
  const differingFields = getVaryingComparisonFields([variety, cropCulture], cropCulture);

  if (differingFields.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" data-testid="sole-variety-difference-summary">
        {t('hierarchy.soleVarietyNoDifferences')}
      </Typography>
    );
  }

  return (
    <Box sx={summaryGridSx} data-testid="sole-variety-difference-summary">
      {differingFields.map((field) => (
        <Box key={field.id}>
          <Typography variant="body2" color="text.secondary">
            {t(field.labelKey)}
          </Typography>
          <Typography variant="body1">
            {getComparisonCellValue(variety, cropCulture, field, t, locale)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
