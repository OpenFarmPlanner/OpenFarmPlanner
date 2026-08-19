/**
 * BasicInfoSection: Name, Variety, Crop Family, Nutrient Demand
 */
import type { ReactNode } from 'react';
import { Autocomplete, Box, CircularProgress, TextField, FormControl, InputLabel, MenuItem } from '@mui/material';
import type { AutocompleteChangeReason } from '@mui/material/Autocomplete';
import { fieldRowSx, mediumFieldSx, smallFieldSx, wideFieldSx } from './styles.tsx';
import type { Culture } from '../../api/types';
import type { TFunction } from 'i18next';
import { TypeaheadSelect as Select } from '../../components/inputs/TypeaheadSelect';
import { VarietyFieldTooltip } from '../VarietyFieldTooltip';
import type { GetVarietyFieldTooltipProps } from '../varietyFieldTooltipHelpers';
import { mergeVarietyFieldSx } from '../varietyValueAccent';
import type { PublicCultureSpeciesOption } from '../publicCultureNameSuggestions';

interface BasicInfoSectionProps {
  formData: Partial<Culture>;
  errors: Record<string, string>;
  onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
  t: TFunction;
  identityHint?: ReactNode;
  showIdentityFields?: boolean;
  showVarietyField?: boolean;
  /** Whether the variety field is a required input. False for the public-library admin edit form, where a blank variety marks the species-level ("general crop") entry. */
  varietyRequired?: boolean;
  showFirstVarietyField?: boolean;
  firstVarietyName?: string;
  onFirstVarietyNameChange?: (value: string) => void;
  /**
   * Variety suggestions for the optional first variety of a brand-new crop.
   * Same source as `varietyOptions`; empty until the Name field matches a
   * public crop species, which keeps the field free text otherwise.
   */
  firstVarietyOptions?: string[];
  firstVarietyOptionsLoading?: boolean;
  onFirstVarietyCommit?: (variety: string, reason?: AutocompleteChangeReason) => void;
  /** Explicit "apply library values" offer for first-variety free text matching a suggestion exactly. */
  firstVarietyApplyHint?: ReactNode;
  /** Shown once a library entry got linked to the first variety (dropdown pick or explicit apply). */
  firstVarietySourceHint?: ReactNode;
  /** Shown when the typed crop name already exists as a private culture. */
  existingCropHint?: ReactNode;
  /** Deduplicated crop-species-level name suggestions (never "Species · Variety" combinations). */
  nameOptions?: PublicCultureSpeciesOption[];
  nameOptionsLoading?: boolean;
  onNameSearchChange?: (value: string) => void;
  onNameOptionSelect?: (option: PublicCultureSpeciesOption | null) => void;
  /** Explicit "apply library values" offer for Name free text matching a suggestion exactly. */
  nameApplyHint?: ReactNode;
  /** Variety suggestions for the crop species currently matched in the Name field; empty otherwise. */
  varietyOptions?: string[];
  varietyOptionsLoading?: boolean;
  onVarietyCommit?: (variety: string, reason?: AutocompleteChangeReason) => void;
  /** Explicit "apply library values" offer for Variety free text matching a suggestion exactly. */
  varietyApplyHint?: ReactNode;
  getFieldTooltipProps?: GetVarietyFieldTooltipProps;
}

export function BasicInfoSection({
  formData,
  errors,
  onChange,
  t,
  identityHint,
  showIdentityFields = true,
  showVarietyField = true,
  varietyRequired = true,
  showFirstVarietyField = false,
  firstVarietyName,
  onFirstVarietyNameChange,
  firstVarietyOptions,
  firstVarietyOptionsLoading = false,
  onFirstVarietyCommit,
  firstVarietyApplyHint,
  firstVarietySourceHint,
  existingCropHint,
  nameOptions,
  nameOptionsLoading = false,
  onNameSearchChange,
  onNameOptionSelect,
  nameApplyHint,
  varietyOptions,
  varietyOptionsLoading = false,
  onVarietyCommit,
  varietyApplyHint,
  getFieldTooltipProps,
}: BasicInfoSectionProps) {
  const nameAutocomplete = nameOptions && onNameSearchChange && onNameOptionSelect
    ? {
      options: nameOptions,
      onSearchChange: onNameSearchChange,
      onSelect: onNameOptionSelect,
    }
    : null;
  const varietyAutocomplete = varietyOptions && onVarietyCommit
    ? { options: varietyOptions, onCommit: onVarietyCommit }
    : null;
  const firstVarietyAutocomplete = firstVarietyOptions && onFirstVarietyCommit
    ? { options: firstVarietyOptions, onCommit: onFirstVarietyCommit }
    : null;
  const cropFamilyVariety = getFieldTooltipProps?.('crop_family');
  const nutrientDemandVariety = getFieldTooltipProps?.('nutrient_demand');
  const rotationBreakYearsVariety = getFieldTooltipProps?.('rotation_break_years');

  return (
    <>
      {showIdentityFields || showVarietyField ? (
        <Box sx={fieldRowSx}>
          {showIdentityFields ? (
            nameAutocomplete ? (
            <Autocomplete<PublicCultureSpeciesOption, false, false, true>
              freeSolo
              clearOnBlur={false}
              options={nameAutocomplete.options}
              value={formData.name ?? ''}
              inputValue={formData.name ?? ''}
              loading={nameOptionsLoading}
              getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
              isOptionEqualToValue={(option, value) => typeof value !== 'string' && option.key === value.key}
              filterOptions={(options) => options}
              groupBy={() => t('form.publicCultureSuggestionsGroupLabel')}
              onInputChange={(_, value, reason) => {
                if (reason === 'reset') {
                  return;
                }
                nameAutocomplete.onSearchChange(value);
                onChange('name', value);
                nameAutocomplete.onSelect(null);
              }}
              onChange={(_, value) => {
                if (typeof value === 'string') {
                  onChange('name', value);
                  nameAutocomplete.onSelect(null);
                  return;
                }
                if (value) {
                  onChange('name', value.name);
                  nameAutocomplete.onSelect(value);
                  return;
                }
                onChange('name', '');
                nameAutocomplete.onSelect(null);
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
                  slotProps={{
                    ...params.slotProps,

                    htmlInput: { ...params.slotProps.htmlInput, maxLength: 200 },

                    input: {
                      ...params.slotProps.input,
                      endAdornment: (
                        <>
                          {nameOptionsLoading ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.slotProps.input.endAdornment}
                        </>
                      ),
                    }
                  }} />
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
          )
          ) : null}
          {showVarietyField ? (
            varietyAutocomplete ? (
              <Autocomplete<string, false, false, true>
                freeSolo
                clearOnBlur={false}
                options={varietyAutocomplete.options}
                value={formData.variety ?? ''}
                inputValue={formData.variety ?? ''}
                loading={varietyOptionsLoading}
                groupBy={() => t('form.publicCultureSuggestionsGroupLabel')}
                onInputChange={(_, value, reason) => {
                  if (reason === 'reset') {
                    return;
                  }
                  onChange('variety', value);
                }}
                onChange={(_, value, reason) => {
                  varietyAutocomplete.onCommit(value ?? '', reason);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    sx={wideFieldSx}
                    required={varietyRequired}
                    label={t('form.variety')}
                    placeholder={t('form.varietyPlaceholder')}
                    error={Boolean(errors.variety)}
                    helperText={errors.variety}
                    slotProps={{
                      ...params.slotProps,

                      htmlInput: { ...params.slotProps.htmlInput, maxLength: 200 },

                      input: {
                        ...params.slotProps.input,
                        endAdornment: (
                          <>
                            {varietyOptionsLoading ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.slotProps.input.endAdornment}
                          </>
                        ),
                      }
                    }} />
                )}
              />
            ) : (
              <TextField
                sx={wideFieldSx}
                required={varietyRequired}
                label={t('form.variety')}
                placeholder={t('form.varietyPlaceholder')}
                value={formData.variety}
                onChange={e => onChange('variety', e.target.value)}
                error={Boolean(errors.variety)}
                helperText={errors.variety}
                slotProps={{ htmlInput: { maxLength: 200 } }}
              />
            )
          ) : null}
        </Box>
      ) : null}
      {nameApplyHint || varietyApplyHint ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {nameApplyHint}
          {varietyApplyHint}
        </Box>
      ) : null}
      {showFirstVarietyField && existingCropHint ? (
        <Box sx={fieldRowSx}>{existingCropHint}</Box>
      ) : null}
      {showFirstVarietyField ? (
        <Box sx={fieldRowSx}>
          {firstVarietyAutocomplete ? (
            <Autocomplete<string, false, false, true>
              freeSolo
              clearOnBlur={false}
              options={firstVarietyAutocomplete.options}
              value={firstVarietyName ?? ''}
              inputValue={firstVarietyName ?? ''}
              loading={firstVarietyOptionsLoading}
              groupBy={() => t('form.publicCultureSuggestionsGroupLabel')}
              onInputChange={(_, value, reason) => {
                if (reason === 'reset') {
                  return;
                }
                onFirstVarietyNameChange?.(value);
              }}
              onChange={(_, value, reason) => {
                firstVarietyAutocomplete.onCommit(value ?? '', reason);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  sx={wideFieldSx}
                  label={t('form.firstVarietyLabel')}
                  placeholder={t('form.firstVarietyPlaceholder')}
                  helperText={t('form.firstVarietyHelperText')}
                  slotProps={{
                    ...params.slotProps,

                    htmlInput: { ...params.slotProps.htmlInput, maxLength: 200 },

                    input: {
                      ...params.slotProps.input,
                      endAdornment: (
                        <>
                          {firstVarietyOptionsLoading ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.slotProps.input.endAdornment}
                        </>
                      ),
                    }
                  }} />
              )}
            />
          ) : (
            <TextField
              sx={wideFieldSx}
              label={t('form.firstVarietyLabel')}
              placeholder={t('form.firstVarietyPlaceholder')}
              value={firstVarietyName ?? ''}
              onChange={e => onFirstVarietyNameChange?.(e.target.value)}
              helperText={t('form.firstVarietyHelperText')}
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
          )}
        </Box>
      ) : null}
      {showFirstVarietyField && firstVarietyApplyHint ? (
        <Box sx={fieldRowSx}>{firstVarietyApplyHint}</Box>
      ) : null}
      {showFirstVarietyField && firstVarietySourceHint ? (
        <Box sx={fieldRowSx}>{firstVarietySourceHint}</Box>
      ) : null}
      {identityHint}
      <Box sx={{ ...fieldRowSx, alignItems: 'flex-end' }}>
        <VarietyFieldTooltip tooltipTitle={cropFamilyVariety?.tooltipTitle}>
          <TextField
            sx={mergeVarietyFieldSx(mediumFieldSx, cropFamilyVariety?.sx)}
            label={t('form.cropFamily')}
            placeholder={t('form.cropFamilyPlaceholder')}
            value={formData.crop_family}
            onChange={e => onChange('crop_family', e.target.value)}
          />
        </VarietyFieldTooltip>
        <VarietyFieldTooltip tooltipTitle={nutrientDemandVariety?.tooltipTitle}>
          <FormControl sx={mergeVarietyFieldSx(smallFieldSx, nutrientDemandVariety?.sx)}>
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
        </VarietyFieldTooltip>
        <VarietyFieldTooltip tooltipTitle={rotationBreakYearsVariety?.tooltipTitle}>
          <TextField
            type="number"
            sx={mergeVarietyFieldSx(smallFieldSx, rotationBreakYearsVariety?.sx)}
            label={t('form.rotationBreakYears')}
            value={formData.rotation_break_years ?? ''}
            onChange={e => onChange('rotation_break_years', e.target.value === '' ? null : parseInt(e.target.value, 10))}
            slotProps={{ htmlInput: { min: 0 } }}
          />
        </VarietyFieldTooltip>
      </Box>
    </>
  );
}
