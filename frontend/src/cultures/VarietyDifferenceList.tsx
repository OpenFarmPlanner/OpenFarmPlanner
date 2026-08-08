import { Box, Typography } from '@mui/material';
import type { Culture } from '../api/types';
import { useTranslation } from '../i18n';
import { resolveLocaleFromLanguage } from '../utils/numberLocalization';
import { getVarietyDifferences } from './varietyComparisonFields';

interface VarietyDifferenceListProps {
  variety: Culture;
  cropCulture: Culture;
}

const differenceGridSx = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, minmax(0, 1fr))',
  },
  gap: 1,
  mt: 0.5,
} as const;

export function VarietyDifferenceList({ variety, cropCulture }: VarietyDifferenceListProps) {
  const { t, i18n } = useTranslation('cultures');
  const locale = resolveLocaleFromLanguage(i18n.resolvedLanguage ?? i18n.language);
  const differences = getVarietyDifferences(variety, cropCulture, t, locale);

  if (differences.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {t('hierarchy.varietyComparison.noDifferences')}
      </Typography>
    );
  }

  return (
    <Box sx={differenceGridSx}>
      {differences.map((difference) => (
        <Box key={difference.id}>
          <Typography variant="caption" color="text.secondary">
            {difference.label}
          </Typography>
          <Typography variant="body2">
            {difference.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
