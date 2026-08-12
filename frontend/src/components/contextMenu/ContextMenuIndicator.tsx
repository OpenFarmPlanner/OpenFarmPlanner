import MoreVertIcon from '@mui/icons-material/MoreVert';
import IconButton from '@mui/material/IconButton';
import type { SxProps, Theme } from '@mui/material/styles';
import type { MouseEvent } from 'react';
import { CONTEXT_MENU_INDICATOR_CLASS } from './contextMenuIndicatorStyles';
import { AppTooltip } from '../AppTooltip';

interface ContextMenuIndicatorProps {
  /** Tooltip text and aria-label. */
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  tabIndex?: number;
  sx?: SxProps<Theme>;
  /**
   * Adds a small translucent backdrop behind the icon, for hosts with
   * unpredictable content/color directly behind the indicator (a Gantt bar,
   * a chart segment) where plain `color: inherit` can leave it hard to spot
   * against similarly-colored or overlapping text. Not needed for the
   * data-grid-row case, which already sits on its own opaque overlay panel.
   */
  withBackdrop?: boolean;
}

/**
 * One shared "more actions / context menu available here" affordance, used
 * everywhere a row/bar/segment supports right-click (desktop) or long-press
 * (touch) for a context menu. Renders the standard Material Design MoreVert
 * (⋮) icon — same icon, size, and hover animation everywhere — rather than
 * a bespoke cursor or icon, so the same visual language appears across
 * data-grid rows, hierarchy rows, supplier/seed-demand tables, Gantt
 * bars/rows, and chart segments.
 *
 * Not visible on its own: render it inside a host styled with
 * `contextMenuIndicatorHostSx` (simple case) or inside a
 * `contextMenuActionsOverlaySx` panel (data-grid-style row case) — both in
 * `./contextMenuIndicatorStyles`. Those reveal it on hover/focus-within, and
 * keep it visible on coarse-pointer (touch) devices, where hover doesn't
 * apply.
 */
export function ContextMenuIndicator({ label, onClick, tabIndex, sx, withBackdrop }: ContextMenuIndicatorProps) {
  return (
    <AppTooltip
      title={label}
      disableInteractive
      slotProps={{ popper: { style: { pointerEvents: 'none' } } }}
    >
      <IconButton
        className={CONTEXT_MENU_INDICATOR_CLASS}
        size="small"
        aria-label={label}
        tabIndex={tabIndex}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClick(event);
        }}
        sx={{
          opacity: 0,
          pointerEvents: 'none',
          transition: 'opacity 120ms ease-in-out, background-color 120ms ease-in-out',
          ...(withBackdrop
            ? {
                color: '#fff',
                bgcolor: 'rgba(0, 0, 0, 0.32)',
                '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.48)' },
              }
            : undefined),
          ...sx,
        }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
    </AppTooltip>
  );
}
