import type { MouseEvent, Ref } from 'react';
import {
  Button,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';

import { useTranslation } from '../../i18n';
import { AppTooltip } from '../AppTooltip';

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
  const { t } = useTranslation(['ganttChart', 'common']);

  return searchExpanded ? (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <TextField
        size="small"
        placeholder={t('ganttChart:treeFilters.searchPlaceholder')}
        value={searchText}
        onChange={(event) => onSearchTextChange(event.target.value)}
        inputRef={searchInputRef}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
        sx={{ flex: '1 1 auto', minWidth: 0 }}
      />
      <AppTooltip title={t('ganttChart:treeFilters.clearSearch')}>
        <IconButton
          size="small"
          aria-label={t('ganttChart:treeFilters.clearSearch')}
          onClick={onClearSearch}
          sx={{ width: 40, height: 40, border: '1px solid', borderColor: 'divider' }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </AppTooltip>
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
          minWidth: 0,
          px: 1,
          whiteSpace: 'nowrap',
          borderColor: activeFilterCount > 0 ? 'text.secondary' : 'divider',
          bgcolor: activeFilterCount > 0 ? 'action.selected' : 'transparent',
        }}
      >
        {activeFilterCount > 0
          ? t('ganttChart:treeFilters.filterButtonWithCount', { count: activeFilterCount })
          : t('ganttChart:treeFilters.filterButton')}
      </Button>
    </Stack>
  ) : (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <AppTooltip title={t('common:actions.search')}>
        <IconButton
          size="small"
          aria-label={t('common:actions.search')}
          onClick={onOpenSearch}
          sx={{ width: 40, height: 40, border: '1px solid', borderColor: 'divider' }}
        >
          <SearchIcon fontSize="small" />
        </IconButton>
      </AppTooltip>
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
          borderColor: activeFilterCount > 0 ? 'text.secondary' : 'divider',
          bgcolor: activeFilterCount > 0 ? 'action.selected' : 'transparent',
        }}
      >
        {activeFilterCount > 0
          ? t('ganttChart:treeFilters.filterButtonWithCount', { count: activeFilterCount })
          : t('ganttChart:treeFilters.filterButton')}
      </Button>
    </Stack>
  );
}
