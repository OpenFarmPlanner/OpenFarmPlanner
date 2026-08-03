import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { CultivationType, SeedRateUnit } from '../api/types';
import {
  formatNumber,
  formatSeedRateNumber,
  formatSeedUnitLabel,
} from './cultureDetailFormatters';

export interface CultureSeedRateRow {
  method: CultivationType;
  value: number;
  unit: SeedRateUnit | string;
  safety: number | null;
}

interface CultureSeedDetailsProps {
  activeCultivationTypes: CultivationType[];
  seedRateRows: CultureSeedRateRow[];
  sowingSafetyPercent?: number | null;
  seedingRequirement?: number | null;
  seedingRequirementType?: 'per_sqm' | 'per_plant' | '';
  thousandKernelWeightG?: number | null;
  emptyValueLabel: string;
  locale: string;
  t: (key: string) => string;
}

const seedDetailGridSx = {
  display: 'grid',
  gridTemplateColumns: {
    xs: '1fr',
    sm: 'repeat(2, minmax(180px, 1fr))',
    lg: 'repeat(3, minmax(180px, 1fr))',
  },
  gap: 2,
  justifyContent: 'start',
} as const;

export function CultureSeedDetails({
  activeCultivationTypes,
  seedRateRows,
  sowingSafetyPercent,
  seedingRequirement,
  seedingRequirementType,
  thousandKernelWeightG,
  emptyValueLabel,
  locale,
  t,
}: CultureSeedDetailsProps) {
  const hasSingleSeedRate = seedRateRows.length > 0 && activeCultivationTypes.length <= 1;
  const hasMethodSeedRates = seedRateRows.length > 0 && activeCultivationTypes.length > 1;

  return (
    <Box sx={seedDetailGridSx}>
      {hasSingleSeedRate && (
        <Box>
          <Typography variant="body2" color="text.secondary">{t('form.seedAmountLabel')}</Typography>
          <Typography variant="body1">
            {formatSeedRateNumber(seedRateRows[0].value, t, locale)} {formatSeedUnitLabel(seedRateRows[0].unit, t)}
          </Typography>
        </Box>
      )}
      {hasSingleSeedRate && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t('detail.fields.seedSafetyMargin')}
          </Typography>
          <Typography variant="body1">
            {seedRateRows[0].safety !== null ? `${formatNumber(seedRateRows[0].safety, t, locale)} ${t('detail.units.percent')}` : '-'}
          </Typography>
        </Box>
      )}
      {hasMethodSeedRates && (
        <Box sx={{ gridColumn: '1 / -1' }}>
          <Typography variant="body2" color="text.secondary">{t('detail.fields.seedRateByCultivation')}</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('detail.fields.method')}</TableCell>
                <TableCell>{t('form.seedAmountLabel')}</TableCell>
                <TableCell>{t('form.seedUnitLabel')}</TableCell>
                <TableCell>{t('detail.fields.seedSafetyMarginPercent')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {seedRateRows.map((row) => (
                <TableRow key={`${row.method}-${row.unit}-${row.value}`}>
                  <TableCell>{row.method === 'pre_cultivation' ? t('form.cultivationTypePreCultivation') : t('form.cultivationTypeDirectSowing')}</TableCell>
                  <TableCell>{formatSeedRateNumber(row.value, t, locale)}</TableCell>
                  <TableCell>{formatSeedUnitLabel(row.unit, t)}</TableCell>
                  <TableCell>{row.safety !== null ? `${formatNumber(row.safety, t, locale)} ${t('detail.units.percent')}` : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
      {seedRateRows.length === 0 && sowingSafetyPercent !== undefined && sowingSafetyPercent !== null && (
        <Box>
          <Typography variant="body2" color="text.secondary">
            {t('detail.fields.seedSafetyMargin')}
          </Typography>
          <Typography variant="body1">
            {formatNumber(sowingSafetyPercent, t, locale)} {t('detail.units.percent')}
          </Typography>
        </Box>
      )}
      {seedingRequirement !== undefined && seedingRequirement !== null && (
        <Box>
          <Typography variant="body2" color="text.secondary">
            {t('detail.fields.seedingRequirement')}
          </Typography>
          <Typography variant="body1">
            {formatSeedRateNumber(seedingRequirement, t, locale)}
            {seedingRequirementType === 'per_sqm'
              ? ` ${t('detail.seedingRequirementTypes.perSqm')}`
              : seedingRequirementType === 'per_plant'
                ? ` ${t('detail.seedingRequirementTypes.perPlant')}`
                : ''}
          </Typography>
        </Box>
      )}
      <Box>
        <Typography variant="body2" color="text.secondary">
          {t('form.thousandKernelWeightLabel')}
        </Typography>
        <Typography variant="body1">
          {thousandKernelWeightG !== null && thousandKernelWeightG !== undefined
            ? `${formatNumber(thousandKernelWeightG, t, locale)} ${t('detail.units.grams')}`
            : emptyValueLabel}
        </Typography>
      </Box>
    </Box>
  );
}
