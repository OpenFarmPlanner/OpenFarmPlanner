import type { ReactNode } from 'react';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, Stack, Typography } from '@mui/material';
import type { Culture } from '../api/types';
import { AppTooltip } from '../components/AppTooltip';
import { useTranslation } from '../i18n';
import { VarietiesComparisonTable } from './VarietiesComparisonTable';

interface VarietyOverviewRow {
  culture: Culture;
  label: string;
}

interface CultureVarietiesOverviewProps {
  varieties: VarietyOverviewRow[];
  cropCulture: Culture;
  onSelect: (culture: Culture) => void;
  action?: ReactNode;
}

export function CultureVarietiesOverview({
  varieties,
  cropCulture,
  onSelect,
  action,
}: CultureVarietiesOverviewProps) {
  const { t } = useTranslation('cultures');

  return (
    <Box sx={{ mb: 3, p: { xs: 1.25, sm: 2 }, border: '1px solid #e5e7eb', borderRadius: 2 }}>
      <Stack
        direction="row"
        sx={{
          mb: varieties.length > 0 ? 1.5 : 0,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Stack direction="row" sx={{ alignItems: 'center' }} spacing={0.5}>
          <Typography variant="h6">
            {t('hierarchy.varietiesTitle')}
          </Typography>
          <AppTooltip title={t('hierarchy.varietiesColumnsTooltip')}>
            <Box component="span" tabIndex={0} sx={{ display: 'inline-flex', color: 'text.secondary', cursor: 'default' }}>
              <InfoOutlinedIcon fontSize="small" />
            </Box>
          </AppTooltip>
        </Stack>
        {action}
      </Stack>
      {varieties.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t('hierarchy.varietiesEmpty')}
        </Typography>
      ) : (
        <VarietiesComparisonTable
          varieties={varieties}
          cropCulture={cropCulture}
          onSelect={onSelect}
        />
      )}
    </Box>
  );
}
