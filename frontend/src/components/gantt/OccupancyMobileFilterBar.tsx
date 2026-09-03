import type { MouseEvent, Ref } from 'react';
import { Button } from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';

import { useTranslation } from '../../i18n';
import { GanttMobileSearchRow } from './GanttMobileSearchRow';

interface OccupancyMobileFilterBarProps {
  /** Show the expanded search field instead of the search icon. */
  searchExpanded: boolean;
  searchText: string;
  onSearchTextChange: (value: string) => void;
  searchInputRef: Ref<HTMLInputElement>;
  onClearSearch: () => void;
  onOpenSearch: () => void;
  /** Whether the calendar-filters popover is open (for ARIA wiring). */
  filterPopoverOpen: boolean;
  activeFilterCount: number;
  onOpenFilterPopover: (event: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * Presentational mobile filter bar for the bed-occupancy calendar: the
 * collapsible search row plus the filter button that anchors the
 * calendar-filters popover. All state (search text, popover anchor,
 * filter counts) lives in GanttChart.tsx; the popover itself is rendered
 * by the page next to this bar.
 */
export function OccupancyMobileFilterBar({
  searchExpanded,
  searchText,
  onSearchTextChange,
  searchInputRef,
  onClearSearch,
  onOpenSearch,
  filterPopoverOpen,
  activeFilterCount,
  onOpenFilterPopover,
}: OccupancyMobileFilterBarProps) {
  const { t } = useTranslation('ganttChart');

  return (
    <GanttMobileSearchRow
      searchExpanded={searchExpanded}
      placeholder={t('ganttChart:treeFilters.searchPlaceholder')}
      searchText={searchText}
      onSearchTextChange={onSearchTextChange}
      searchInputRef={searchInputRef}
      onClearSearch={onClearSearch}
      onOpenSearch={onOpenSearch}
    >
      <Button
        size="small"
        variant="outlined"
        color="inherit"
        startIcon={<TuneIcon fontSize="small" />}
        onClick={onOpenFilterPopover}
        aria-expanded={filterPopoverOpen}
        aria-haspopup="dialog"
        aria-controls={filterPopoverOpen ? 'calendar-filters-popover' : undefined}
        sx={{
          minHeight: 40,
          whiteSpace: 'nowrap',
          // The expanded search field is the flexible element in the row, so
          // the button gives up its default padding to leave room for it.
          ...(searchExpanded ? { minWidth: 0, px: 1 } : {}),
          borderColor: activeFilterCount > 0 ? 'text.secondary' : 'divider',
          bgcolor: activeFilterCount > 0 ? 'action.selected' : 'transparent',
        }}
      >
        {activeFilterCount > 0
          ? t('ganttChart:treeFilters.filterButtonWithCount', { count: activeFilterCount })
          : t('ganttChart:treeFilters.filterButton')}
      </Button>
    </GanttMobileSearchRow>
  );
}
