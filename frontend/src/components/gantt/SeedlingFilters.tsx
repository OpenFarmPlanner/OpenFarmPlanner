import type { Ref } from 'react';
import { Box } from '@mui/material';

import { useTranslation } from '../../i18n';
import { GanttMobileSearchRow } from './GanttMobileSearchRow';
import { GanttSearchField } from './GanttSearchField';
import { ganttDesktopFilterRowSx } from './ganttFilterBarStyles';

interface SeedlingFiltersProps {
  /** Mobile layout renders a collapsible search icon; desktop a plain field. */
  useMobileLayout: boolean;
  /** Mobile only: show the expanded search field instead of the icon. */
  searchExpanded: boolean;
  searchText: string;
  onSearchTextChange: (value: string) => void;
  searchInputRef: Ref<HTMLInputElement>;
  onClearSearch: () => void;
  onOpenSearch: () => void;
}

/**
 * Presentational filter bar for the seedling calendar (search only).
 * Search state and the expand/clear handlers live in GanttChart.tsx;
 * this component only renders.
 */
export function SeedlingFilters({
  useMobileLayout,
  searchExpanded,
  searchText,
  onSearchTextChange,
  searchInputRef,
  onClearSearch,
  onOpenSearch,
}: SeedlingFiltersProps) {
  const { t } = useTranslation('ganttChart');
  const placeholder = t('ganttChart:treeFilters.searchPlaceholderSeedlings');

  return (
    <Box
      data-testid="seedling-filters"
      sx={{
        mb: { xs: 0, md: 1.5 },
      }}
    >
      {useMobileLayout ? (
        <GanttMobileSearchRow
          searchExpanded={searchExpanded}
          placeholder={placeholder}
          searchText={searchText}
          onSearchTextChange={onSearchTextChange}
          searchInputRef={searchInputRef}
          onClearSearch={onClearSearch}
          onOpenSearch={onOpenSearch}
        />
      ) : (
        <Box sx={ganttDesktopFilterRowSx}>
          <GanttSearchField
            placeholder={placeholder}
            value={searchText}
            onValueChange={onSearchTextChange}
            inputRef={searchInputRef}
            sx={{ minWidth: 240, flex: '1 1 240px' }}
          />
        </Box>
      )}
    </Box>
  );
}
