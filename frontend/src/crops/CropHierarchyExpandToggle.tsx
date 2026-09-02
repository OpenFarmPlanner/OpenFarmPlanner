import type { SxProps, Theme } from '@mui/material';
import { Box, IconButton } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { cropChevronButtonSx } from './cropHierarchyRowSx';

interface CropHierarchyExpandToggleProps {
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  expandLabel: string;
  collapseLabel: string;
  sx?: SxProps<Theme>;
  /** Width of the spacer rendered for rows without children, in pixels. */
  placeholderWidth?: number;
}

/**
 * Chevron toggle for a crop hierarchy row, shared by the desktop lists and
 * mobile selector dialogs in CropDetail, PublicCropLibraryPage, and their
 * mobile counterparts.
 */
export function CropHierarchyExpandToggle({
  hasChildren,
  isExpanded,
  onToggle,
  expandLabel,
  collapseLabel,
  sx = cropChevronButtonSx,
  placeholderWidth = 24,
}: CropHierarchyExpandToggleProps) {
  if (!hasChildren) {
    return <Box component="span" sx={{ width: placeholderWidth, flexShrink: 0 }} />;
  }

  return (
    <IconButton
      size="small"
      aria-label={isExpanded ? collapseLabel : expandLabel}
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      sx={sx}
    >
      {isExpanded ? <KeyboardArrowDownIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
    </IconButton>
  );
}
