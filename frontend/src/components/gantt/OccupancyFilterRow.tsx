import type { Ref } from 'react';
import {
  Box,
  Checkbox,
  FormControlLabel,
  MenuItem,
} from '@mui/material';

import { useTranslation } from '../../i18n';
import type { Location } from '../../api/api';
import type { OccupancyHierarchyNode } from '../../pages/ganttChartUtils';
import { TypeaheadSelect as Select } from '../inputs/TypeaheadSelect';
import { GanttSearchField } from './GanttSearchField';

interface OccupancyFilterRowProps {
  searchText: string;
  onSearchTextChange: (value: string) => void;
  searchInputRef: Ref<HTMLInputElement>;
  locations: Location[];
  /** Field nodes of the currently selected location (empty for 'all'). */
  fieldOptions: OccupancyHierarchyNode[];
  locationFilter: number | 'all';
  /** Selecting a location also resets the field filter — handled by the page. */
  onLocationFilterChange: (value: number | 'all') => void;
  fieldFilter: number | 'all';
  onFieldFilterChange: (value: number | 'all') => void;
  onlyOccupiedBeds: boolean;
  onOnlyOccupiedBedsChange: (checked: boolean) => void;
}

/**
 * Presentational desktop filter row for the bed-occupancy calendar
 * (search, location, field, only-occupied-beds). All filter state lives in
 * GanttChart.tsx; this component only renders and parses select values.
 */
export function OccupancyFilterRow({
  searchText,
  onSearchTextChange,
  searchInputRef,
  locations,
  fieldOptions,
  locationFilter,
  onLocationFilterChange,
  fieldFilter,
  onFieldFilterChange,
  onlyOccupiedBeds,
  onOnlyOccupiedBedsChange,
}: OccupancyFilterRowProps) {
  const { t } = useTranslation(['ganttChart', 'common']);

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1.5,
        alignItems: 'center',
      }}
    >
      <GanttSearchField
        placeholder={t('ganttChart:treeFilters.searchPlaceholder')}
        value={searchText}
        onValueChange={onSearchTextChange}
        inputRef={searchInputRef}
        sx={{ minWidth: 240, flex: '1 1 240px' }}
      />
      <Select
        size="small"
        value={locationFilter === 'all' ? 'all' : String(locationFilter)}
        onChange={(event) => {
          const { value } = event.target;
          onLocationFilterChange(value === 'all' ? 'all' : Number(value));
        }}
        sx={{ minWidth: 160 }}
      >
        <MenuItem value="all">{t('ganttChart:treeFilters.allLocations')}</MenuItem>
        {locations.filter((location) => location.id).map((location) => (
          <MenuItem key={location.id} value={String(location.id)}>{location.name}</MenuItem>
        ))}
      </Select>
      <Select
        size="small"
        value={fieldFilter === 'all' ? 'all' : String(fieldFilter)}
        onChange={(event) => {
          const { value } = event.target;
          onFieldFilterChange(value === 'all' ? 'all' : Number(value));
        }}
        disabled={locationFilter === 'all'}
        sx={{ minWidth: 160 }}
      >
        <MenuItem value="all">{t('ganttChart:treeFilters.allFields')}</MenuItem>
        {fieldOptions.map((field) => (
          <MenuItem key={field.id} value={String(field.fieldId)}>{field.name}</MenuItem>
        ))}
      </Select>
      <FormControlLabel
        control={(
          <Checkbox
            size="small"
            checked={onlyOccupiedBeds}
            onChange={(event) => onOnlyOccupiedBedsChange(event.target.checked)}
          />
        )}
        label={t('ganttChart:treeFilters.onlyOccupiedBeds')}
      />
    </Box>
  );
}
