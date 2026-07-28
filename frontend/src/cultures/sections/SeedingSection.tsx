import { useState } from 'react';
import { Box, Typography, TextField, FormControl, InputLabel, MenuItem } from '@mui/material';
import type { Culture, SeedRateUnit } from '../../api/types';
import type { TFunction } from 'i18next';
import { compactFieldSx, fieldRowSx, mediumFieldSx, smallFieldSx } from './styles.tsx';
import { DropdownAwareTooltip } from '../../components/DropdownAwareTooltip';
import { TypeaheadSelect as Select } from '../../components/inputs/TypeaheadSelect';

interface SeedingSectionProps {
  formData: Partial<Culture>;
  errors: Record<string, string>;
  onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
  t: TFunction;
}

const seedRateUnitOptions: Array<{ value: SeedRateUnit; label: string }> = [
  { value: 'g_per_m2', label: 'g / m²' },
  { value: 'g_per_lfm', label: 'g / lfm' },
  { value: 'seeds_per_m2', label: 'Korn / m²' },
  { value: 'seeds_per_lfm', label: 'Korn / lfm' },
  { value: 'seeds_per_plant', label: 'Korn / Pflanze' },
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
}: {
  title: string;
  valueField: 'seed_rate_direct_value' | 'seed_rate_pre_cultivation_value';
  unitField: 'seed_rate_direct_unit' | 'seed_rate_pre_cultivation_unit';
  safetyField: 'sowing_calculation_safety_percent_direct' | 'sowing_calculation_safety_percent_pre_cultivation';
  formData: Partial<Culture>;
  errors: Record<string, string>;
  onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
  t: TFunction;
}) {
  const [unitSelectOpen, setUnitSelectOpen] = useState(false);

  return (
    <>
      <Typography variant="subtitle1" sx={{ mt: 2 }}>{title}</Typography>
      <Box sx={fieldRowSx}>
        <DropdownAwareTooltip title={t('form.seedRateHelp')} arrow>
          <TextField
            sx={compactFieldSx}
            type="number"
            label={t('form.seedAmountLabel')}
            value={formData[valueField] ?? ''}
            onChange={(e) => onChange(valueField, e.target.value ? parseFloat(e.target.value) : null)}
            error={Boolean(errors[valueField])}
            helperText={errors[valueField]}
            slotProps={{ htmlInput: { min: 0.001, step: 0.001 } }}
          />
        </DropdownAwareTooltip>

        <DropdownAwareTooltip title={unitSelectOpen ? '' : t('form.seedRateHelp')} arrow>
          <FormControl sx={smallFieldSx} error={Boolean(errors[unitField])}>
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
                return seedRateUnitOptions.find((option) => option.value === selected)?.label ?? '';
              }}
              displayEmpty
            >
              {seedRateUnitOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </Select>
            {errors[unitField] && (
              <Typography variant="caption" color="error">{errors[unitField]}</Typography>
            )}
          </FormControl>
        </DropdownAwareTooltip>

        <DropdownAwareTooltip title={t('form.sowingCalculationSafetyPercentHelp')} arrow>
          <TextField
            sx={mediumFieldSx}
            type="number"
            label={t('form.sowingCalculationSafetyPercentLabel')}
            value={formData[safetyField] ?? ''}
            onChange={(e) => onChange(safetyField, e.target.value ? parseFloat(e.target.value) : null)}
            error={Boolean(errors[safetyField])}
            helperText={errors[safetyField]}
            slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
          />
        </DropdownAwareTooltip>
      </Box>
    </>
  );
}

export function SeedingSection({ formData, errors, onChange, t }: SeedingSectionProps) {
  const cultivationTypes = formData.cultivation_types ?? (formData.cultivation_type ? [formData.cultivation_type] : []);
  const showsDirect = cultivationTypes.includes('direct_sowing');
  const showsPreCultivation = cultivationTypes.includes('pre_cultivation');
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
        />
      )}

      <Box sx={fieldRowSx}>
        <DropdownAwareTooltip title={t('form.thousandKernelWeightHelp')} arrow>
          <TextField
            sx={smallFieldSx}
            type="text"
            inputMode="decimal"
            label={t('form.thousandKernelWeightLabel')}
            value={formData.thousand_kernel_weight_g ?? ''}
            onChange={(event) => handleThousandKernelWeightChange(event.target.value)}
            error={Boolean(errors.thousand_kernel_weight_g)}
            helperText={errors.thousand_kernel_weight_g}
          />
        </DropdownAwareTooltip>
      </Box>

    </>
  );
}
