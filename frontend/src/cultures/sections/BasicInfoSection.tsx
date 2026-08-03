/**
 * BasicInfoSection: Name, Variety, Crop Family, Nutrient Demand
 */
import type { ReactNode } from 'react';
import { Autocomplete, Box, CircularProgress, TextField, FormControl, InputLabel, MenuItem } from '@mui/material';
import { fieldRowSx, mediumFieldSx, smallFieldSx, wideFieldSx } from './styles.tsx';
import type { Culture, PublicCulture } from '../../api/types';
import type { TFunction } from 'i18next';
import { TypeaheadSelect as Select } from '../../components/inputs/TypeaheadSelect';

interface BasicInfoSectionProps {
  formData: Partial<Culture>;
  errors: Record<string, string>;
  onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
  t: TFunction;
  identityHint?: ReactNode;
  showIdentityFields?: boolean;
  publicCultureOptions?: PublicCulture[];
  publicCultureOptionsLoading?: boolean;
  onPublicCultureSearchChange?: (value: string) => void;
  onPublicCultureSelect?: (culture: PublicCulture | null) => void;
}

const getPublicCultureOptionLabel = (option: PublicCulture | string): string => {
  if (typeof option === 'string') {
    return option;
  }
  const name = option.display_name || option.crop_species_name || option.name;
  return option.variety ? `${name} · ${option.variety}` : name;
};

export function BasicInfoSection({
  formData,
  errors,
  onChange,
  t,
  identityHint,
  showIdentityFields = true,
  publicCultureOptions,
  publicCultureOptionsLoading = false,
  onPublicCultureSearchChange,
  onPublicCultureSelect,
}: BasicInfoSectionProps) {
  const publicCultureAutocomplete = publicCultureOptions && onPublicCultureSearchChange && onPublicCultureSelect
    ? {
      options: publicCultureOptions,
      onSearchChange: onPublicCultureSearchChange,
      onSelect: onPublicCultureSelect,
    }
    : null;

  return (
    <>
      {showIdentityFields ? (
        <Box sx={fieldRowSx}>
          {publicCultureAutocomplete ? (
            <Autocomplete<PublicCulture, false, false, true>
              freeSolo
              clearOnBlur={false}
              options={publicCultureAutocomplete.options}
              value={formData.name ?? ''}
              inputValue={formData.name ?? ''}
              loading={publicCultureOptionsLoading}
              getOptionLabel={getPublicCultureOptionLabel}
              isOptionEqualToValue={(option, value) => typeof value !== 'string' && option.id === value.id}
              filterOptions={(options) => options}
              onInputChange={(_, value, reason) => {
                if (reason === 'reset') {
                  return;
                }
                publicCultureAutocomplete.onSearchChange(value);
                onChange('name', value);
                publicCultureAutocomplete.onSelect(null);
              }}
              onChange={(_, value) => {
                if (typeof value === 'string') {
                  onChange('name', value);
                  publicCultureAutocomplete.onSelect(null);
                  return;
                }
                if (value) {
                  publicCultureAutocomplete.onSelect(value);
                  return;
                }
                onChange('name', '');
                publicCultureAutocomplete.onSelect(null);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  sx={wideFieldSx}
                  required
                  label={t('form.name')}
                  placeholder={t('form.namePlaceholder')}
                  error={Boolean(errors.name)}
                  helperText={errors.name || t('form.publicCultureAutocompleteHelp')}
                  slotProps={{ htmlInput: { ...params.inputProps, maxLength: 200 } }}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {publicCultureOptionsLoading ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          ) : (
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
          )}
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
