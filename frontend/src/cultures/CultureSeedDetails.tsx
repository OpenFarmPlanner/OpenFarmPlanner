import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { ReactNode } from 'react';
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
  valueSource?: ValueSource | null;
  safetySource?: ValueSource | null;
}

export type ValueSource = 'fromCrop' | 'ownValue';

interface CultureSeedDetailsProps {
  activeCultivationTypes: CultivationType[];
  seedRateRows: CultureSeedRateRow[];
  sowingSafetyPercent?: number | null;
  sowingSafetySource?: ValueSource | null;
  seedingRequirement?: number | null;
  seedingRequirementSource?: ValueSource | null;
  seedingRequirementType?: 'per_sqm' | 'per_plant' | '';
  seedingRequirementTypeSource?: ValueSource | null;
  thousandKernelWeightG?: number | null;
  thousandKernelWeightSource?: ValueSource | null;
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

const ownValueSx = {
  color: 'primary.main',
  fontWeight: 700,
} as const;

function getOwnValueSx(source?: ValueSource | null) {
  return source === 'ownValue' ? ownValueSx : undefined;
}

function ValueWithSource({
  children,
  source,
}: {
  children: ReactNode;
  source?: ValueSource | null;
}) {
  return (
    <Typography variant="body1" sx={getOwnValueSx(source)}>
      {children}
    </Typography>
  );
}

export function CultureSeedDetails({
  activeCultivationTypes,
  seedRateRows,
  sowingSafetyPercent,
  sowingSafetySource = null,
  seedingRequirement,
  seedingRequirementSource = null,
  seedingRequirementType,
  seedingRequirementTypeSource = null,
  thousandKernelWeightG,
  thousandKernelWeightSource = null,
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
          <Typography variant="body2" color="text.secondary" sx={getOwnValueSx(seedRateRows[0].valueSource)}>
            {t('form.seedAmountLabel')}
          </Typography>
          <ValueWithSource source={seedRateRows[0].valueSource}>
            {formatSeedRateNumber(seedRateRows[0].value, t, locale)} {formatSeedUnitLabel(seedRateRows[0].unit, t)}
          </ValueWithSource>
        </Box>
      )}
      {hasSingleSeedRate && (
        <Box>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 1, ...getOwnValueSx(seedRateRows[0].safetySource) }}
          >
            {t('detail.fields.seedSafetyMargin')}
          </Typography>
          <ValueWithSource source={seedRateRows[0].safetySource}>
            {seedRateRows[0].safety !== null ? `${formatNumber(seedRateRows[0].safety, t, locale)} ${t('detail.units.percent')}` : '-'}
          </ValueWithSource>
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
                  <TableCell sx={getOwnValueSx(row.valueSource)}>
                    {formatSeedRateNumber(row.value, t, locale)}
                  </TableCell>
                  <TableCell>
                    {formatSeedUnitLabel(row.unit, t)}
                  </TableCell>
                  <TableCell sx={getOwnValueSx(row.safetySource)}>
                    {row.safety !== null ? `${formatNumber(row.safety, t, locale)} ${t('detail.units.percent')}` : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
      {seedRateRows.length === 0 && sowingSafetyPercent !== undefined && sowingSafetyPercent !== null && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={getOwnValueSx(sowingSafetySource)}>
            {t('detail.fields.seedSafetyMargin')}
          </Typography>
          <ValueWithSource source={sowingSafetySource}>
            {formatNumber(sowingSafetyPercent, t, locale)} {t('detail.units.percent')}
          </ValueWithSource>
        </Box>
      )}
      {seedingRequirement !== undefined && seedingRequirement !== null && (
        <Box>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={getOwnValueSx(seedingRequirementSource ?? seedingRequirementTypeSource)}
          >
            {t('detail.fields.seedingRequirement')}
          </Typography>
          <ValueWithSource source={seedingRequirementSource ?? seedingRequirementTypeSource}>
            {formatSeedRateNumber(seedingRequirement, t, locale)}
            {seedingRequirementType === 'per_sqm'
              ? ` ${t('detail.seedingRequirementTypes.perSqm')}`
              : seedingRequirementType === 'per_plant'
                ? ` ${t('detail.seedingRequirementTypes.perPlant')}`
                : ''}
          </ValueWithSource>
        </Box>
      )}
      <Box>
        <Typography variant="body2" color="text.secondary" sx={getOwnValueSx(thousandKernelWeightSource)}>
          {t('form.thousandKernelWeightLabel')}
        </Typography>
        <ValueWithSource source={thousandKernelWeightSource}>
          {thousandKernelWeightG !== null && thousandKernelWeightG !== undefined
            ? `${formatNumber(thousandKernelWeightG, t, locale)} ${t('detail.units.grams')}`
            : emptyValueLabel}
        </ValueWithSource>
      </Box>
    </Box>
  );
}
