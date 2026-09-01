import { useState } from 'react';
import { Box, Typography, TextField, FormControl, InputLabel, MenuItem } from '@mui/material';
import type { Culture, SeedRateUnit, SeedRateUnitConstraints } from '../../api/types';
import type { TFunction } from 'i18next';
import { compactFieldSx, fieldRowSx, mediumFieldSx, smallFieldSx } from './styles.tsx';
import { DropdownAwareTooltip } from '../../components/DropdownAwareTooltip';
import { TypeaheadSelect as Select } from '../../components/inputs/TypeaheadSelect';
import type { GetVarietyFieldTooltipProps } from '../varietyFieldTooltipHelpers';
import { mergeVarietyFieldSx } from '../varietyValueAccent';
import { getSeedRateValueInputProps } from '../seedRateConstraints';

interface SeedingSectionProps {
  formData: Partial<Culture>;
  errors: Record<string, string>;
  onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
  t: TFunction;
  getFieldTooltipProps?: GetVarietyFieldTooltipProps;
  seedRateUnitConstraints?: Partial<SeedRateUnitConstraints> | null;
}

const seedRateUnitOptions: Array<{ value: SeedRateUnit; labelKey: string }> = [
  { value: 'g_per_m2', labelKey: 'detail.seedUnits.gPerSqm' },
  { value: 'g_per_lfm', labelKey: 'detail.seedUnits.gPerRunningMeter' },
  { value: 'seeds_per_m2', labelKey: 'detail.seedUnits.seedsPerSqm' },
  { value: 'seeds_per_lfm', labelKey: 'detail.seedUnits.seedsPerRunningMeter' },
  { value: 'seeds_per_plant', labelKey: 'detail.seedUnits.seedsPerPlant' },
];

const toSeedRateUnitSelectValue = (value: unknown): SeedRateUnit | '' => {
  if (value === '-' || value === null || value === undefined || value === '') {
    return '';
  }
  return value as SeedRateUnit;
};

function SeedRateBlock({
  title,
  valueField,
  unitField,
  safetyField,
  formData,
  errors,
  onChange,
  t,
  getFieldTooltipProps,
  seedRateUnitConstraints,
}: {
  title: string;
  valueField: 'seed_rate_direct_value' | 'seed_rate_pre_cultivation_value';
  unitField: 'seed_rate_direct_unit' | 'seed_rate_pre_cultivation_unit';
  safetyField: 'sowing_calculation_safety_percent_direct' | 'sowing_calculation_safety_percent_pre_cultivation';
  formData: Partial<Culture>;
  errors: Record<string, string>;
  onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
  t: TFunction;
  getFieldTooltipProps?: GetVarietyFieldTooltipProps;
  seedRateUnitConstraints?: Partial<SeedRateUnitConstraints> | null;
}) {
  const [unitSelectOpen, setUnitSelectOpen] = useState(false);
  const rateVariety = getFieldTooltipProps?.([valueField, unitField], t('form.seedRateHelp'));
  const safetyVariety = getFieldTooltipProps?.(safetyField, t('form.sowingCalculationSafetyPercentHelp'));
  const selectedUnit = toSeedRateUnitSelectValue(formData[unitField]);
  const valueInputProps = getSeedRateValueInputProps(selectedUnit || null, seedRateUnitConstraints);

  return (
    <>
      <Typography variant="subtitle1" sx={{ mt: 2 }}>{title}</Typography>
      <Box sx={fieldRowSx}>
        <DropdownAwareTooltip title={rateVariety?.tooltipTitle ?? t('form.seedRateHelp')} arrow>
          <TextField
            sx={mergeVarietyFieldSx(compactFieldSx, rateVariety?.sx)}
            type="number"
            label={t('form.seedAmountLabel')}
            value={formData[valueField] ?? ''}
            onChange={(e) => onChange(valueField, e.target.value ? parseFloat(e.target.value) : null)}
            error={Boolean(errors[valueField])}
            helperText={errors[valueField]}
            slotProps={{ htmlInput: valueInputProps }}
          />
        </DropdownAwareTooltip>

        <DropdownAwareTooltip title={unitSelectOpen ? '' : (rateVariety?.tooltipTitle ?? t('form.seedRateHelp'))} arrow>
          <FormControl sx={mergeVarietyFieldSx(smallFieldSx, rateVariety?.sx)} error={Boolean(errors[unitField])}>
            <InputLabel shrink>{t('form.seedUnitLabel')}</InputLabel>
            <Select
              fullWidth
              value={toSeedRateUnitSelectValue(formData[unitField])}
              label={t('form.seedUnitLabel')}
              onChange={(e) => onChange(unitField, (e.target.value || null) as Culture[typeof unitField])}
              onOpen={() => setUnitSelectOpen(true)}
              onClose={() => setUnitSelectOpen(false)}
              renderValue={(selected) => {
                if (!selected) {
                  return (
                    <Typography component="span" color="text.secondary">
                      {t('form.seedUnitPlaceholder')}
                    </Typography>
                  );
                }
                const selectedOption = seedRateUnitOptions.find((option) => option.value === selected);
                return selectedOption ? t(selectedOption.labelKey) : '';
              }}
              displayEmpty
            >
              {seedRateUnitOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>{t(option.labelKey)}</MenuItem>
              ))}
            </Select>
            {errors[unitField] && (
              <Typography variant="caption" color="error">{errors[unitField]}</Typography>
            )}
          </FormControl>
        </DropdownAwareTooltip>

        <DropdownAwareTooltip title={safetyVariety?.tooltipTitle ?? t('form.sowingCalculationSafetyPercentHelp')} arrow>
          <TextField
            sx={mergeVarietyFieldSx(mediumFieldSx, safetyVariety?.sx)}
            type="number"
            label={t('form.sowingCalculationSafetyPercentLabel')}
            value={formData[safetyField] ?? ''}
            onChange={(e) => onChange(safetyField, e.target.value ? parseFloat(e.target.value) : null)}
            error={Boolean(errors[safetyField])}
            helperText={errors[safetyField]}
            slotProps={{ htmlInput: { min: 0, max: 100, step: 1, inputMode: 'decimal' } }}
          />
        </DropdownAwareTooltip>
      </Box>
    </>
  );
}

export function SeedingSection({
  formData,
  errors,
  onChange,
  t,
  getFieldTooltipProps,
  seedRateUnitConstraints,
}: SeedingSectionProps) {
  const cultivationTypes = formData.cultivation_types ?? (formData.cultivation_type ? [formData.cultivation_type] : []);
  const showsDirect = cultivationTypes.includes('direct_sowing');
  const showsPreCultivation = cultivationTypes.includes('pre_cultivation');
  const thousandKernelWeightVariety = getFieldTooltipProps?.('thousand_kernel_weight_g', t('form.thousandKernelWeightHelp'));
  const handleThousandKernelWeightChange = (rawValue: string): void => {
    const normalized = rawValue.trim().replace(',', '.');
    if (!normalized) {
      onChange('thousand_kernel_weight_g', undefined);
      return;
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      onChange('thousand_kernel_weight_g', undefined);
      return;
    }
    onChange('thousand_kernel_weight_g', parsed);
  };

  return (
    <>
      <Typography variant="h6" sx={{ mt: 2 }}>{t('form.seedRateSectionTitle')}</Typography>

      {showsDirect && (
        <SeedRateBlock
          title={t('form.seedRateDirectSectionTitle')}
          valueField="seed_rate_direct_value"
          unitField="seed_rate_direct_unit"
          safetyField="sowing_calculation_safety_percent_direct"
          formData={formData}
          errors={errors}
          onChange={onChange}
          t={t}
          getFieldTooltipProps={getFieldTooltipProps}
          seedRateUnitConstraints={seedRateUnitConstraints}
        />
      )}

      {showsPreCultivation && (
        <SeedRateBlock
          title={t('form.seedRatePreCultivationSectionTitle')}
          valueField="seed_rate_pre_cultivation_value"
          unitField="seed_rate_pre_cultivation_unit"
          safetyField="sowing_calculation_safety_percent_pre_cultivation"
          formData={formData}
          errors={errors}
          onChange={onChange}
          t={t}
          getFieldTooltipProps={getFieldTooltipProps}
          seedRateUnitConstraints={seedRateUnitConstraints}
        />
      )}

      <Box sx={fieldRowSx}>
        <DropdownAwareTooltip title={thousandKernelWeightVariety?.tooltipTitle ?? t('form.thousandKernelWeightHelp')} arrow>
          <TextField
            sx={mergeVarietyFieldSx(smallFieldSx, thousandKernelWeightVariety?.sx)}
            type="text"
            inputMode="decimal"
            label={t('form.thousandKernelWeightLabel')}
            value={formData.thousand_kernel_weight_g ?? ''}
            onChange={(event) => handleThousandKernelWeightChange(event.target.value)}
            error={Boolean(errors.thousand_kernel_weight_g)}
            helperText={errors.thousand_kernel_weight_g}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          />
        </DropdownAwareTooltip>
      </Box>

    </>
  );
}
