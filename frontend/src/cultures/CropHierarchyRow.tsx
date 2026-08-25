import type { MouseEvent, ReactNode } from 'react';
import { ListItemButton, ListItemText, Typography } from '@mui/material';
import { CropHierarchyExpandToggle } from './CropHierarchyExpandToggle';
import { HighlightedText } from '../components/HighlightedText';
import { compactCropChevronButtonSx } from './cropHierarchyRowSx';
import type { CultureListItemProps } from './useCultureListKeyboardNavigation';

interface CropHierarchyRowProps {
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  expandLabel: string;
  collapseLabel: string;
  isSelected: boolean;
  isClickable: boolean;
  primary: string;
  isPrimaryEmphasized: boolean;
  secondary?: string;
  varietyCount?: number;
  /**
   * Shows "(0)" on a row that has no varieties instead of no count at all.
   * The Kultur search list needs every group header to carry a hit count;
   * plain browsing lists stay quieter and leave an empty group uncounted.
   */
  showZeroVarietyCount?: boolean;
  /**
   * Lower-cased needle whose occurrences are marked inside `primary`. Left
   * unset, the row renders plain text.
   */
  highlightQuery?: string;
  ariaLabel?: string;
  onClick: () => void;
  onDoubleClick: (event: MouseEvent) => void;
  itemProps?: Partial<CultureListItemProps>;
  /**
   * Handles Enter/Space on the row itself. Returning `true` marks the key
   * press as fully handled and suppresses the selection click it would
   * otherwise produce — see the `onClick` comment below.
   */
  onKeyboardActivate?: () => boolean;
  endAdornment?: ReactNode;
  /**
   * When true, `endAdornment` (the pending-suggestion hourglass) takes the
   * slot the "(N)" count normally occupies instead of following it, so the
   * icon lines up with rows that have no count at all. The count still shows
   * alongside the icon once there is more than one variety, so that
   * information isn't lost.
   */
  isPendingSuggestion?: boolean;
}

/**
 * Compact list row for the crop hierarchy tree, shared by the desktop lists
 * in CultureDetail (private "Crops" page) and PublicCropLibraryPage (public
 * crop library) so their row markup and spacing can't drift apart.
 */
export function CropHierarchyRow({
  depth,
  hasChildren,
  isExpanded,
  onToggleExpand,
  expandLabel,
  collapseLabel,
  isSelected,
  isClickable,
  primary,
  isPrimaryEmphasized,
  secondary,
  varietyCount,
  showZeroVarietyCount = false,
  highlightQuery,
  ariaLabel,
  onClick,
  onDoubleClick,
  itemProps = {},
  onKeyboardActivate,
  endAdornment,
  isPendingSuggestion = false,
}: CropHierarchyRowProps) {
  const hasCount = typeof varietyCount === 'number' && (varietyCount > 0 || showZeroVarietyCount);
  const countLabel = hasCount ? (
    <Typography
      component="span"
      sx={{
        fontSize: { xs: '0.72rem', lg: '0.76rem' },
        color: 'text.disabled',
        flexShrink: 0,
        ml: 1,
      }}
    >
      {`(${varietyCount})`}
    </Typography>
  ) : null;
  return (
    <ListItemButton
      {...itemProps}
      role={isClickable ? 'option' : 'presentation'}
      aria-label={ariaLabel}
      aria-selected={isClickable ? isSelected : undefined}
      aria-expanded={hasChildren ? isExpanded : undefined}
      selected={isSelected}
      disabled={!isClickable}
      onClick={(event) => {
        // MUI turns Enter on a non-native button into a programmatic
        // `.click()`, which arrives here indistinguishable from a pointer
        // click except for its zero `detail`. That is the only hook a caller
        // has for giving Enter its own meaning on a row.
        if (event.detail === 0 && onKeyboardActivate?.()) {
          return;
        }
        onClick();
      }}
      onDoubleClick={onDoubleClick}
      sx={{
        borderRadius: 1.5,
        ml: `calc(${depth * 1.75}rem)`,
        pl: { xs: 0.75, lg: 0.875 },
        pr: { xs: 0.875, lg: 1 },
        py: { xs: 0.1875, lg: 0.25 },
        mb: { xs: 0.125, lg: 0.1875 },
        alignItems: 'center',
        border: '1px solid transparent',
        '&:hover': { bgcolor: '#f4f8f4', borderColor: '#d6e6d8' },
        '&.Mui-selected': {
          bgcolor: 'rgba(37, 111, 42, 0.12)',
          borderColor: 'rgba(37, 111, 42, 0.32)',
        },
        '&.Mui-selected:hover': { bgcolor: 'rgba(37, 111, 42, 0.16)' },
      }}
    >
      <CropHierarchyExpandToggle
        hasChildren={hasChildren}
        isExpanded={isExpanded}
        onToggle={onToggleExpand}
        expandLabel={expandLabel}
        collapseLabel={collapseLabel}
        sx={compactCropChevronButtonSx}
      />
      <ListItemText
        primary={highlightQuery ? <HighlightedText text={primary} query={highlightQuery} /> : primary}
        secondary={secondary}
        sx={{ my: 0 }}
        slotProps={{
          primary: {
            sx: {
              fontSize: { xs: '0.9rem', lg: '0.95rem' },
              fontWeight: isPrimaryEmphasized ? 700 : 500,
              lineHeight: 1.2,
            },
          },

          secondary: {
            sx: {
              fontSize: { xs: '0.74rem', lg: '0.78rem' },
              color: 'text.secondary',
              lineHeight: 1.1,
            },
          }
        }} />
      {isPendingSuggestion ? (
        <>
          {endAdornment}
          {typeof varietyCount === 'number' && varietyCount > 1 ? countLabel : null}
        </>
      ) : (
        <>
          {countLabel}
          {endAdornment}
        </>
      )}
    </ListItemButton>
  );
}
