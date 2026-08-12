import type { Ref } from 'react';
import {
  Box,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';

import { useTranslation } from '../../i18n';
import { AppTooltip } from '../AppTooltip';

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
  const { t } = useTranslation(['ganttChart', 'common']);

  return (
    <Box
      data-testid="seedling-filters"
      sx={{
        mb: { xs: 0, md: 1.5 },
      }}
    >
      {useMobileLayout ? (
        <Stack spacing={0}>
          {searchExpanded ? (
            <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", }} >
              <TextField
                size="small"
                placeholder={t('ganttChart:treeFilters.searchPlaceholderSeedlings')}
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
            </Stack>
          ) : (
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
          )}
        </Stack>
      ) : (
        <Box
          sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1.5,
              alignItems: 'center',
          }}
        >
          <TextField
            size="small"
            placeholder={t('ganttChart:treeFilters.searchPlaceholderSeedlings')}
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
            sx={{ minWidth: 240, flex: '1 1 240px' }}
          />
        </Box>
      )}
    </Box>
  );
}
