import { useState, type ReactNode } from 'react';
import { Box, type SxProps, type Theme, type TooltipProps } from '@mui/material';
import { AppTooltip } from '../AppTooltip';

export const FULL_CELL_TOOLTIP_CELL_CLASS = 'ofp-cell-full-tooltip';

export interface FullCellTooltipProps
  extends Pick<TooltipProps, 'title' | 'describeChild' | 'disableInteractive' | 'enterDelay' | 'slotProps'> {
  children: ReactNode;
  cellHasFocus?: boolean;
  focusable?: boolean;
  triggerSx?: SxProps<Theme>;
}

export function FullCellTooltip({
  children,
  cellHasFocus = false,
  focusable = false,
  triggerSx,
  ...tooltipProps
}: FullCellTooltipProps) {
  const [isInteractionOpen, setIsInteractionOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  return (
    <AppTooltip
      {...tooltipProps}
      open={cellHasFocus || isFocused || isInteractionOpen}
      onOpen={() => setIsInteractionOpen(true)}
      onClose={() => setIsInteractionOpen(false)}
    >
      <Box
        component="span"
        className="ofp-full-cell-tooltip-trigger"
        tabIndex={focusable ? 0 : undefined}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        sx={[
          {
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            minWidth: 0,
            px: 1.25,
          },
          ...(Array.isArray(triggerSx) ? triggerSx : [triggerSx]),
        ]}
      >
        {children}
      </Box>
    </AppTooltip>
  );
}
