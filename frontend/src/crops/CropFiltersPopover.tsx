import type { ReactElement } from 'react';
import {
  FormControl,
  InputLabel,
  MenuItem,
  TextField,
} from '@mui/material';

import { useTranslation } from '../i18n';
import type { PersistedCropFilters } from './cropDetailFormatters';
import { TypeaheadSelect as Select } from '../components/inputs/TypeaheadSelect';
import { FilterPopoverShell } from '../components/filters/FilterPopoverShell';

interface CropFiltersPopoverProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  filters: PersistedCropFilters;
  onFilterChange: <K extends keyof PersistedCropFilters>(
    key: K,
    value: PersistedCropFilters[K],
  ) => void;
  familyOptions: string[];
  supplierOptions: Array<{ id: string; name: string }>;
  monthOptions: Array<{ value: number; label: string }>;
  /** Clears all filters and closes the popover — handled by the parent. */
  onReset: () => void;
}

/**
 * Presentational advanced-filters popover for the crop selector
 * (family, cultivation type, nutrient demand, supplier, growth days,
 * sowing months, yield). All filter state lives in CropDetail.tsx.
 */
export function CropFiltersPopover({
  anchorEl,
  onClose,
  filters,
  onFilterChange,
  familyOptions,
  supplierOptions,
  monthOptions,
  onReset,
}: CropFiltersPopoverProps): ReactElement {
  const { t } = useTranslation('crops');

  return (
    <FilterPopoverShell
      id="crop-filters-popover"
      anchorEl={anchorEl}
      onClose={onClose}
      onReset={onReset}
      resetLabel={t('filters.reset')}
    >
        <FormControl size="small" sx={{ gridColumn: '1 / -1' }}>
          <InputLabel id="crop-family-filter-label">{t('filters.cropFamily')}</InputLabel>
          <Select
            fullWidth
            labelId="crop-family-filter-label"
            value={filters.selectedFamilyFilter}
            label={t('filters.cropFamily')}
            onChange={(event) => onFilterChange('selectedFamilyFilter', event.target.value)}
          >
            <MenuItem value="">{t('filters.all')}</MenuItem>
            {familyOptions.map((family) => (
              <MenuItem key={family} value={family}>{family}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small">
          <InputLabel id="crop-method-filter-label">{t('filters.cultivationType')}</InputLabel>
          <Select
            fullWidth
            labelId="crop-method-filter-label"
            value={filters.selectedCultivationFilter}
            label={t('filters.cultivationType')}
            onChange={(event) => onFilterChange('selectedCultivationFilter', event.target.value)}
          >
            <MenuItem value="">{t('filters.all')}</MenuItem>
            <MenuItem value="direct_sowing">{t('filters.directSowing')}</MenuItem>
            <MenuItem value="pre_cultivation">{t('filters.preCultivation')}</MenuItem>
            <MenuItem value="both">{t('filters.both')}</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small">
          <InputLabel id="crop-nutrient-filter-label">{t('filters.nutrientDemand')}</InputLabel>
          <Select
            fullWidth
            labelId="crop-nutrient-filter-label"
            value={filters.selectedNutrientFilter}
            label={t('filters.nutrientDemand')}
            onChange={(event) => onFilterChange('selectedNutrientFilter', event.target.value)}
          >
            <MenuItem value="">{t('filters.all')}</MenuItem>
            <MenuItem value="low">{t('filters.nutrientLow')}</MenuItem>
            <MenuItem value="medium">{t('filters.nutrientMedium')}</MenuItem>
            <MenuItem value="high">{t('filters.nutrientHigh')}</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ gridColumn: '1 / -1' }}>
          <InputLabel id="crop-supplier-filter-label">{t('filters.supplier')}</InputLabel>
          <Select
            fullWidth
            labelId="crop-supplier-filter-label"
            value={filters.selectedSupplierFilter}
            label={t('filters.supplier')}
            onChange={(event) => onFilterChange('selectedSupplierFilter', event.target.value)}
          >
            <MenuItem value="">{t('filters.all')}</MenuItem>
            {supplierOptions.map((supplier) => (
              <MenuItem key={supplier.id} value={supplier.id}>{supplier.name}</MenuItem>
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
        <FormControl size="small" sx={{ gridColumn: '1 / -1' }}>
          <InputLabel id="crop-sowing-month-filter-label">{t('filters.sowingMonths')}</InputLabel>
          <Select
            fullWidth
            multiple
            labelId="crop-sowing-month-filter-label"
            value={filters.selectedSowingMonths}
            label={t('filters.sowingMonths')}
            onChange={(event) => onFilterChange('selectedSowingMonths', event.target.value as number[])}
            renderValue={(selected) => (
              (selected as number[])
                .map((value) => monthOptions.find((option) => option.value === value)?.label ?? value)
                .join(', ')
            )}
          >
            {monthOptions.map((month) => (
              <MenuItem key={month.value} value={month.value}>{month.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
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
