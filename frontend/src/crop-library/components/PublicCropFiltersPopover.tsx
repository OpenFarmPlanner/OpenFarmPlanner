import type { ReactElement } from 'react';
import { FormControl, InputLabel, MenuItem, TextField } from '@mui/material';
import { useTranslation } from '../../i18n';
import { FilterPopoverShell } from '../../components/filters/FilterPopoverShell';
import { TypeaheadSelect as Select } from '../../components/inputs/TypeaheadSelect';
import type { PublicCropFilterOptions, PublicCropFilterState } from '../publicCropFilters';

interface PublicCropFiltersPopoverProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  filters: PublicCropFilterState;
  onFilterChange: <K extends keyof PublicCropFilterState>(key: K, value: PublicCropFilterState[K]) => void;
  options: PublicCropFilterOptions;
  onReset: () => void;
}

/**
 * Advanced-filters popover for public crop data (crop family, variety,
 * cultivation type, nutrient demand, growth duration, expected yield).
 * Shares its chrome with CropFiltersPopover (the private crop
 * selector's filter popover) via FilterPopoverShell, and is itself shared
 * between the full public crop library page and the "import from library"
 * dialog so both filter the same way.
 */
export function PublicCropFiltersPopover({
  anchorEl,
  onClose,
  filters,
  onFilterChange,
  options,
  onReset,
}: PublicCropFiltersPopoverProps): ReactElement {
  const { t } = useTranslation('crops');

  const nutrientLabel = (value: string): string => {
    if (value === 'low') return t('filters.nutrientLow');
    if (value === 'medium') return t('filters.nutrientMedium');
    if (value === 'high') return t('filters.nutrientHigh');
    return value;
  };

  return (
    <FilterPopoverShell
      id="public-crop-filters-popover"
      anchorEl={anchorEl}
      onClose={onClose}
      onReset={onReset}
      resetLabel={t('filters.reset')}
    >
      <FormControl size="small" sx={{ gridColumn: '1 / -1' }}>
        <InputLabel id="public-crop-family-filter-label">{t('filters.cropFamily')}</InputLabel>
        <Select
          fullWidth
          labelId="public-crop-family-filter-label"
          value={filters.cropFamily}
          label={t('filters.cropFamily')}
          onChange={(event) => onFilterChange('cropFamily', event.target.value)}
        >
          <MenuItem value="">{t('filters.all')}</MenuItem>
          {options.cropFamilyOptions.map((family) => (
            <MenuItem key={family} value={family}>{family}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ gridColumn: '1 / -1' }}>
        <InputLabel id="public-crop-variety-filter-label">{t('library.filters.variety')}</InputLabel>
        <Select
          fullWidth
          labelId="public-crop-variety-filter-label"
          value={filters.variety}
          label={t('library.filters.variety')}
          onChange={(event) => onFilterChange('variety', event.target.value)}
        >
          <MenuItem value="">{t('filters.all')}</MenuItem>
          {options.varietyOptions.map((variety) => (
            <MenuItem key={variety} value={variety}>{variety}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl size="small">
        <InputLabel id="public-crop-cultivation-filter-label">{t('filters.cultivationType')}</InputLabel>
        <Select
          fullWidth
          labelId="public-crop-cultivation-filter-label"
          value={filters.cultivationType}
          label={t('filters.cultivationType')}
          onChange={(event) => onFilterChange('cultivationType', event.target.value)}
        >
          <MenuItem value="">{t('filters.all')}</MenuItem>
          <MenuItem value="direct_sowing">{t('filters.directSowing')}</MenuItem>
          <MenuItem value="pre_cultivation">{t('filters.preCultivation')}</MenuItem>
          <MenuItem value="both">{t('filters.both')}</MenuItem>
        </Select>
      </FormControl>
      <FormControl size="small">
        <InputLabel id="public-crop-nutrient-filter-label">{t('filters.nutrientDemand')}</InputLabel>
        <Select
          fullWidth
          labelId="public-crop-nutrient-filter-label"
          value={filters.nutrientDemand}
          label={t('filters.nutrientDemand')}
          onChange={(event) => onFilterChange('nutrientDemand', event.target.value)}
        >
          <MenuItem value="">{t('filters.all')}</MenuItem>
          {options.nutrientOptions.map((option) => (
            <MenuItem key={option} value={option}>{nutrientLabel(option)}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        size="small"
        type="number"
        label={t('filters.growthDaysMin')}
        value={filters.growthDaysMin}
        onChange={(event) => onFilterChange('growthDaysMin', event.target.value)}
        slotProps={{ htmlInput: { inputMode: 'numeric' } }}
      />
      <TextField
        size="small"
        type="number"
        label={t('filters.growthDaysMax')}
        value={filters.growthDaysMax}
        onChange={(event) => onFilterChange('growthDaysMax', event.target.value)}
        slotProps={{ htmlInput: { inputMode: 'numeric' } }}
      />
      <TextField
        size="small"
        type="number"
        label={t('filters.yieldMin')}
        value={filters.yieldMin}
        onChange={(event) => onFilterChange('yieldMin', event.target.value)}
        slotProps={{ htmlInput: { inputMode: 'decimal' } }}
      />
      <TextField
        size="small"
        type="number"
        label={t('filters.yieldMax')}
        value={filters.yieldMax}
        onChange={(event) => onFilterChange('yieldMax', event.target.value)}
        slotProps={{ htmlInput: { inputMode: 'decimal' } }}
      />
    </FilterPopoverShell>
  );
}
