import {
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Popover,
  Stack,
} from '@mui/material';

import { useTranslation } from '../../i18n';
import type { Location } from '../../api/api';
import type { OccupancyHierarchyNode } from '../../pages/ganttChartUtils';
import { FilterSelectField } from '../filters/FilterSelectField';

const FULL_WIDTH_FIELD = { minWidth: '100%' } as const;

interface CalendarFiltersPopoverProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
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
  /** Resets all hierarchy filters and closes the popover — handled by the page. */
  onReset: () => void;
}

/**
 * Presentational popover with the mobile calendar hierarchy filters
 * (location, field, only-occupied-beds). All filter state lives in
 * GanttChart.tsx; this component only renders and parses select values.
 */
export function CalendarFiltersPopover({
  anchorEl,
  onClose,
  locations,
  fieldOptions,
  locationFilter,
  onLocationFilterChange,
  fieldFilter,
  onFieldFilterChange,
  onlyOccupiedBeds,
  onOnlyOccupiedBedsChange,
  onReset,
}: CalendarFiltersPopoverProps) {
  const { t } = useTranslation(['ganttChart', 'common']);

  return (
    <Popover
      id="calendar-filters-popover"
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{
        paper: { sx: { width: 'min(92vw, 360px)', p: 1.5 } }
      }}
    >
      <Stack spacing={1.25}>
        <FilterSelectField
          id="calendar-location-filter"
          label={t('ganttChart:treeFilters.locationLabel')}
          value={locationFilter === 'all' ? 'all' : String(locationFilter)}
          onChange={(event) => {
            const { value } = event.target;
            onLocationFilterChange(value === 'all' ? 'all' : Number(value));
          }}
          sx={FULL_WIDTH_FIELD}
        >
          <MenuItem value="all">{t('ganttChart:treeFilters.allLocations')}</MenuItem>
          {locations.filter((location) => location.id).map((location) => (
            <MenuItem key={location.id} value={String(location.id)}>{location.name}</MenuItem>
          ))}
        </FilterSelectField>
        <FilterSelectField
          id="calendar-field-filter"
          label={t('ganttChart:treeFilters.fieldLabel')}
          value={fieldFilter === 'all' ? 'all' : String(fieldFilter)}
          onChange={(event) => {
            const { value } = event.target;
            onFieldFilterChange(value === 'all' ? 'all' : Number(value));
          }}
          disabled={locationFilter === 'all'}
          sx={FULL_WIDTH_FIELD}
        >
          <MenuItem value="all">{t('ganttChart:treeFilters.allFields')}</MenuItem>
          {fieldOptions.map((field) => (
            <MenuItem key={field.id} value={String(field.fieldId)}>{field.name}</MenuItem>
          ))}
        </FilterSelectField>
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
        <Button
          variant="text"
          size="small"
          onClick={onReset}
          sx={{ alignSelf: 'flex-end', whiteSpace: 'nowrap' }}
        >
          {t('ganttChart:treeFilters.resetFilters')}
        </Button>
      </Stack>
    </Popover>
  );
}
