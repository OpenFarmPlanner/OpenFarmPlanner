/**
 * BasicInfoSection: Name, Variety, Crop Family, Nutrient Demand
 */
import type { ReactNode } from 'react';
import { Box, TextField, FormControl, InputLabel, MenuItem } from '@mui/material';
import { fieldRowSx, mediumFieldSx, smallFieldSx, wideFieldSx } from './styles.tsx';
import type { Culture } from '../../api/types';
import type { TFunction } from 'i18next';
import { TypeaheadSelect as Select } from '../../components/inputs/TypeaheadSelect';

interface BasicInfoSectionProps {
  formData: Partial<Culture>;
  errors: Record<string, string>;
  onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
  t: TFunction;
  identityHint?: ReactNode;
  showIdentityFields?: boolean;
}

export function BasicInfoSection({ formData, errors, onChange, t, identityHint, showIdentityFields = true }: BasicInfoSectionProps) {
  return (
    <>
      {showIdentityFields ? (
        <Box sx={fieldRowSx}>
          <TextField
            sx={wideFieldSx}
            required
            label={t('form.name')}
            placeholder={t('form.namePlaceholder')}
            value={formData.name}
            onChange={e => onChange('name', e.target.value)}
            error={Boolean(errors.name)}
            helperText={errors.name}
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />
          <TextField
            sx={wideFieldSx}
            required
            label={t('form.variety')}
            placeholder={t('form.varietyPlaceholder')}
            value={formData.variety}
            onChange={e => onChange('variety', e.target.value)}
            error={Boolean(errors.variety)}
            helperText={errors.variety}
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />
        </Box>
      ) : null}
      {identityHint}
      <Box sx={fieldRowSx}>
        <TextField
          sx={mediumFieldSx}
          label={t('form.cropFamily')}
          placeholder={t('form.cropFamilyPlaceholder')}
          value={formData.crop_family}
          onChange={e => onChange('crop_family', e.target.value)}
        />
      </Box>
      <Box sx={fieldRowSx}>
        <FormControl sx={smallFieldSx}>
          <InputLabel>{t('form.nutrientDemand')}</InputLabel>
          <Select
            fullWidth
            value={formData.nutrient_demand || ''}
            onChange={e => onChange('nutrient_demand', e.target.value)}
            label={t('form.nutrientDemand')}
          >
            <MenuItem value="">{t('noData')}</MenuItem>
            <MenuItem value="low">{t('form.nutrientDemandLow')}</MenuItem>
            <MenuItem value="medium">{t('form.nutrientDemandMedium')}</MenuItem>
            <MenuItem value="high">{t('form.nutrientDemandHigh')}</MenuItem>
          </Select>
        </FormControl>
      </Box>
    </>
  );
}
