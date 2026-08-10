import type { ReactElement } from 'react';
import { FormControl, InputLabel, MenuItem, TextField } from '@mui/material';
import { useTranslation } from '../../i18n';
import { FilterPopoverShell } from '../../components/filters/FilterPopoverShell';
import { TypeaheadSelect as Select } from '../../components/inputs/TypeaheadSelect';
import type { PublicCultureFilterOptions, PublicCultureFilterState } from '../publicCultureFilters';

interface PublicCultureFiltersPopoverProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  filters: PublicCultureFilterState;
  onFilterChange: <K extends keyof PublicCultureFilterState>(key: K, value: PublicCultureFilterState[K]) => void;
  options: PublicCultureFilterOptions;
  onReset: () => void;
}

/**
 * Advanced-filters popover for public culture data (crop family, variety,
 * cultivation type, nutrient demand, growth duration, expected yield).
 * Shares its chrome with CultureFiltersPopover (the private culture
 * selector's filter popover) via FilterPopoverShell, and is itself shared
 * between the full public crop library page and the "import from library"
 * dialog so both filter the same way.
 */
export function PublicCultureFiltersPopover({
  anchorEl,
  onClose,
  filters,
  onFilterChange,
  options,
  onReset,
}: PublicCultureFiltersPopoverProps): ReactElement {
  const { t } = useTranslation('cultures');

  const nutrientLabel = (value: string): string => {
    if (value === 'low') return t('filters.nutrientLow');
    if (value === 'medium') return t('filters.nutrientMedium');
    if (value === 'high') return t('filters.nutrientHigh');
    return value;
  };

  return (
    <FilterPopoverShell
      id="public-culture-filters-popover"
      anchorEl={anchorEl}
      onClose={onClose}
      onReset={onReset}
      resetLabel={t('filters.reset')}
    >
      <FormControl size="small" sx={{ gridColumn: '1 / -1' }}>
        <InputLabel id="public-culture-family-filter-label">{t('filters.cropFamily')}</InputLabel>
        <Select
          fullWidth
          labelId="public-culture-family-filter-label"
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
        <InputLabel id="public-culture-variety-filter-label">{t('library.filters.variety')}</InputLabel>
        <Select
          fullWidth
          labelId="public-culture-variety-filter-label"
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
        <InputLabel id="public-culture-cultivation-filter-label">{t('filters.cultivationType')}</InputLabel>
        <Select
          fullWidth
          labelId="public-culture-cultivation-filter-label"
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
        <InputLabel id="public-culture-nutrient-filter-label">{t('filters.nutrientDemand')}</InputLabel>
        <Select
          fullWidth
          labelId="public-culture-nutrient-filter-label"
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
      />
      <TextField
        size="small"
        type="number"
        label={t('filters.growthDaysMax')}
        value={filters.growthDaysMax}
        onChange={(event) => onFilterChange('growthDaysMax', event.target.value)}
      />
      <TextField
        size="small"
        type="number"
        label={t('filters.yieldMin')}
        value={filters.yieldMin}
        onChange={(event) => onFilterChange('yieldMin', event.target.value)}
      />
      <TextField
        size="small"
        type="number"
        label={t('filters.yieldMax')}
        value={filters.yieldMax}
        onChange={(event) => onFilterChange('yieldMax', event.target.value)}
      />
    </FilterPopoverShell>
  );
}
