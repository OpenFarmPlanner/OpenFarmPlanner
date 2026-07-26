import { alpha } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import type { SystemStyleObject } from '@mui/system';

/** Applied to the `ContextMenuIndicator` button itself, to reveal it. */
export const CONTEXT_MENU_INDICATOR_CLASS = 'ofp-context-menu-indicator';

/** The class every "actions overlay" host targets to reveal its indicator(s). */
export const CONTEXT_MENU_ACTIONS_OVERLAY_CLASS = 'ofp-context-menu-actions-overlay';

const revealOnHoverOrFocus = {
  opacity: 1,
  pointerEvents: 'auto' as const,
};

/**
 * Spread into a hoverable/focusable ancestor's `sx` (e.g. a Gantt bar, a
 * chart segment, a sidebar tree row) so any `ContextMenuIndicator` rendered
 * inside it fades in on hover/focus-within. On touch devices it stays
 * hidden at all times — a long press opens the context menu directly
 * instead of relying on the icon.
 * Use this for simple cases with no adjacent truncated text to mask — for
 * data-grid-style rows, use `contextMenuActionsOverlaySx` instead.
 */
export const contextMenuIndicatorHostSx: SystemStyleObject<Theme> = {
  [`&:hover .${CONTEXT_MENU_INDICATOR_CLASS}, &:focus-within .${CONTEXT_MENU_INDICATOR_CLASS}`]: revealOnHoverOrFocus,
};

/**
 * The positioned, gradient-masked overlay panel used by table-style rows
 * (DataGrid, hierarchy tree, Suppliers, SeedDemand) to host one or more
 * inline action buttons (including a `ContextMenuIndicator`) at the right
 * edge of a cell whose text would otherwise be truncated underneath it.
 * `hoverSelector` is the CSS selector (relative to the row) that reveals
 * the overlay — e.g. `.MuiDataGrid-row:hover &` for DataGrid-based rows, or
 * `tr:hover &` for a plain MUI `<TableRow>`. `focusWithinSelector` is an
 * optional extra reveal condition (e.g. `tr:focus-within &`) for keyboard
 * users on plain tables that don't already have DataGrid's own cell-focus
 * handling — it only toggles opacity/pointer-events, skipping the
 * background/gradient touch-up `hoverSelector` gets.
 *
 * Like `contextMenuIndicatorHostSx`, this stays hidden at all times on
 * touch devices (no `:hover`/coarse-pointer override) — a long press opens
 * the same context menu directly, so the overlay's icons (edit, delete,
 * the `ContextMenuIndicator`) would otherwise sit on top of the row
 * permanently and truncate its text for no reachability benefit.
 */
export function contextMenuActionsOverlaySx(
  hoverSelector: string,
  focusWithinSelector?: string,
): SystemStyleObject<Theme> {
  return {
    position: 'absolute',
    right: 0,
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.5,
    py: 0.25,
    pl: 0.25,
    pr: 0.25,
    borderRadius: 1,
    bgcolor: 'background.paper',
    opacity: 0,
    pointerEvents: 'none',
    transition: 'background-color 120ms ease-in-out, opacity 120ms ease-in-out',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      bottom: 0,
      right: '100%',
      width: 16,
      pointerEvents: 'none',
      background: (theme: Theme) =>
        `linear-gradient(90deg, ${alpha(theme.palette.background.paper, 0)} 0%, ${theme.palette.background.paper} 100%)`,
    },
    [hoverSelector]: {
      bgcolor: 'surface.surfaceHoverBackground',
      ...revealOnHoverOrFocus,
    },
    [`${hoverSelector}::before`]: {
      background: (theme: Theme) => {
        const hoverBackground = theme.palette.surface?.surfaceHoverBackground ?? theme.palette.action.hover;
        return `linear-gradient(90deg, ${alpha(hoverBackground, 0)} 0%, ${hoverBackground} 100%)`;
      },
    },
    // A nested ContextMenuIndicator hides itself by default (for the
    // simple-host case elsewhere), so it needs its own reveal rule here too
    // — the panel's own opacity/pointer-events above don't override a
    // child's explicitly-set opacity:0/pointer-events:none.
    [`${hoverSelector} .${CONTEXT_MENU_INDICATOR_CLASS}`]: revealOnHoverOrFocus,
    ...(focusWithinSelector
      ? {
          [focusWithinSelector]: revealOnHoverOrFocus,
          [`${focusWithinSelector} .${CONTEXT_MENU_INDICATOR_CLASS}`]: revealOnHoverOrFocus,
        }
      : {}),
  };
}
