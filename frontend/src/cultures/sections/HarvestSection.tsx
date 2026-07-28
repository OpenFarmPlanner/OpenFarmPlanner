/**
 * HarvestSection: yield unit and expected yield
 * @remarks Presentational, no internal state
 */
import { Box, Typography, FormControl, InputLabel, MenuItem, TextField } from '@mui/material';
import type { Culture } from '../../api/types';
import type { TFunction } from 'i18next';
import { fieldRowSx, smallFieldSx } from './styles.tsx';
import { TypeaheadSelect as Select } from '../../components/inputs/TypeaheadSelect';

interface HarvestSectionProps {
  formData: Partial<Culture>;
  errors: Record<string, string>;
  onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
  t: TFunction;
}

export function HarvestSection({ formData, errors, onChange, t }: HarvestSectionProps) {
  return (
    <>
      <Typography variant="h6" sx={{ mt: 2 }}>{t('form.sectionHarvest')}</Typography>
      <Box sx={fieldRowSx}>
        <FormControl sx={smallFieldSx} error={Boolean(errors.harvest_method)}>
          <InputLabel>{t('form.yieldUnit')}</InputLabel>
          <Select
            fullWidth
            value={formData.harvest_method || ''}
            onChange={e => onChange('harvest_method', e.target.value)}
            label={t('form.yieldUnit')}
          >
            <MenuItem value="">{t('noData')}</MenuItem>
            <MenuItem value="per_plant">{t('form.yieldUnitPerPlant')}</MenuItem>
            <MenuItem value="per_sqm">{t('form.yieldUnitPerSqm')}</MenuItem>
          </Select>
          {errors.harvest_method && (
            <Typography variant="caption" color="error">{t('form.yieldUnitRequired')}</Typography>
          )}
        </FormControl>
        <TextField
          sx={smallFieldSx}
          type="number"
          label={t('form.expectedYieldWithUnit', { defaultValue: `${t('form.expectedYield')} (${t('form.expectedYieldUnit')})` })}
          placeholder={t('form.expectedYieldPlaceholder')}
          value={formData.expected_yield ?? ''}
          onChange={e => onChange('expected_yield', e.target.value ? parseFloat(e.target.value) : undefined)}
          error={Boolean(errors.expected_yield)}
          helperText={errors.expected_yield}
          slotProps={{ htmlInput: { min: 0, step: 0.01 } }}
        />
      </Box>
    </>
  );
}
