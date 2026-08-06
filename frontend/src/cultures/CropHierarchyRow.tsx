import type { MouseEvent, ReactNode } from 'react';
import { ListItemButton, ListItemText, Typography } from '@mui/material';
import { CropHierarchyExpandToggle } from './CropHierarchyExpandToggle';
import { compactCropChevronButtonSx } from './cropHierarchyRowSx';

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
  ariaLabel?: string;
  onClick: () => void;
  onDoubleClick: (event: MouseEvent) => void;
  itemProps?: Record<string, unknown>;
  endAdornment?: ReactNode;
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
  ariaLabel,
  onClick,
  onDoubleClick,
  itemProps = {},
  endAdornment,
}: CropHierarchyRowProps) {
  return (
    <ListItemButton
      {...itemProps}
      role={isClickable ? 'option' : 'presentation'}
      aria-label={ariaLabel}
      aria-selected={isClickable ? isSelected : undefined}
      selected={isSelected}
      disabled={!isClickable}
      onClick={onClick}
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
        primary={primary}
        primaryTypographyProps={{
          fontSize: { xs: '0.9rem', lg: '0.95rem' },
          fontWeight: isPrimaryEmphasized ? 700 : 500,
          lineHeight: 1.2,
        }}
        secondary={secondary}
        secondaryTypographyProps={{ fontSize: { xs: '0.74rem', lg: '0.78rem' }, color: 'text.secondary', lineHeight: 1.1 }}
        sx={{ my: 0 }}
      />
      {typeof varietyCount === 'number' && varietyCount > 0 ? (
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
      ) : null}
      {endAdornment}
    </ListItemButton>
  );
}
