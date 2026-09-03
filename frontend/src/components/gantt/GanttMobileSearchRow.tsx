import type { ReactNode, Ref } from 'react';
import { Stack } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';

import { useTranslation } from '../../i18n';
import { GanttFilterIconButton } from './GanttFilterIconButton';
import { GanttSearchField } from './GanttSearchField';

interface GanttMobileSearchRowProps {
  /** Show the expanded search field instead of the search icon. */
  searchExpanded: boolean;
  placeholder: string;
  searchText: string;
  onSearchTextChange: (value: string) => void;
  searchInputRef: Ref<HTMLInputElement>;
  onClearSearch: () => void;
  onOpenSearch: () => void;
  /** Trailing controls rendered in the same row, e.g. the filter button. */
  children?: ReactNode;
}

/**
 * Collapsible mobile search row shared by the calendar filter bars: a single
 * search icon that expands into the search field plus a clear button. Only the
 * placeholder and any trailing controls differ between the calendars.
 */
export function GanttMobileSearchRow({
  searchExpanded,
  placeholder,
  searchText,
  onSearchTextChange,
  searchInputRef,
  onClearSearch,
  onOpenSearch,
  children,
}: GanttMobileSearchRowProps) {
  const { t } = useTranslation(['ganttChart', 'common']);

  return (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
      {searchExpanded ? (
        <>
          <GanttSearchField
            placeholder={placeholder}
            value={searchText}
            onValueChange={onSearchTextChange}
            inputRef={searchInputRef}
            sx={{ flex: '1 1 auto', minWidth: 0 }}
          />
          <GanttFilterIconButton title={t('ganttChart:treeFilters.clearSearch')} onClick={onClearSearch}>
            <CloseIcon fontSize="small" />
          </GanttFilterIconButton>
        </>
      ) : (
        <GanttFilterIconButton title={t('common:actions.search')} onClick={onOpenSearch}>
          <SearchIcon fontSize="small" />
        </GanttFilterIconButton>
      )}
      {children}
    </Stack>
  );
}
