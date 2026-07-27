import type { SxProps, Theme } from '@mui/material/styles';

export const NAVIGATION_TRANSITIONS = {
  item: 'background-color 140ms ease, color 140ms ease, border-color 140ms ease',
  icon: 'color 140ms ease',
} as const;

export const getNavigationShellSx = (width: number, sidebarCollapsed = false): SxProps<Theme> => (theme) => ({
  width,
  height: '100dvh',
  minHeight: '100vh',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  borderRight: '1px solid',
  borderColor: theme.palette.surface.surfaceBorder,
  bgcolor: theme.palette.surface.sidebarBackground,
  transition: 'width 0.25s ease',
  position: 'sticky',
  top: 0,
  alignSelf: 'flex-start',
  zIndex: theme.zIndex.modal + 2,
  pointerEvents: 'auto',
  overflow: 'hidden',
  cursor: sidebarCollapsed ? 'pointer' : 'default',
  '&:hover': sidebarCollapsed
    ? {
      bgcolor: theme.palette.navigation.hoverBackground,
    }
    : undefined,
});

export const navigationLogoLinkSx: SxProps<Theme> = (theme) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 1,
  minWidth: 0,
  flex: 1,
  borderRadius: 1,
  px: 0.5,
  py: 0.25,
  textDecoration: 'none',
  color: 'inherit',
  '&:hover': { bgcolor: theme.palette.navigation.hoverBackground },
  '&:focus-visible': {
    outline: 'none',
    boxShadow: `0 0 0 2px ${theme.palette.navigation.focusRing}`,
  },
});

export const navigationLogoTextSx: SxProps<Theme> = (theme) => ({
  color: theme.palette.navigation.inactiveText,
  letterSpacing: 0.1,
});

export const getNavigationToggleButtonSx = (cursor: 'e-resize' | 'w-resize'): SxProps<Theme> => (theme) => ({
  width: 30,
  height: 30,
  color: theme.palette.navigation.inactiveIcon,
  cursor,
  '&:hover': {
    color: theme.palette.navigation.inactiveHoverText,
    bgcolor: theme.palette.navigation.hoverBackground,
  },
});

export const navigationTooltipSx: SxProps<Theme> = (theme) => ({
  bgcolor: theme.palette.navigation.tooltipBackground,
});

/** Shared opacity applied to icon + text of a disabled-during-onboarding nav item. */
export const NAV_ITEM_DISABLED_OPACITY = 0.5;

export const getNavigationItemSx = (
  isActive: boolean,
  sidebarCollapsed: boolean,
  disabled = false,
): SxProps<Theme> => (theme) => ({
  minHeight: 44,
  borderRadius: 1.5,
  mb: 0.75,
  px: 1.25,
  justifyContent: sidebarCollapsed ? 'center' : 'initial',
  color: isActive ? theme.palette.navigation.activeText : theme.palette.navigation.inactiveText,
  bgcolor: isActive ? theme.palette.navigation.activeBackground : 'transparent',
  border: '1px solid',
  borderColor: isActive ? theme.palette.navigation.activeBorder : 'transparent',
  position: 'relative',
  transition: NAVIGATION_TRANSITIONS.item,
  ...(disabled
    ? {
      cursor: 'not-allowed',
      '&.Mui-disabled': { opacity: 1 },
    }
    : {
      '&:hover': {
        bgcolor: isActive ? theme.palette.navigation.activeHoverBackground : theme.palette.navigation.hoverBackground,
        color: isActive ? theme.palette.navigation.activeText : theme.palette.navigation.inactiveHoverText,
        borderColor: isActive ? theme.palette.navigation.activeHoverBorder : theme.palette.navigation.hoverBorder,
      },
    }),
  '&::before': {
    content: '""',
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 999,
    bgcolor: isActive ? theme.palette.navigation.activeAccent : 'transparent',
  },
});

export const getNavigationIconSx = (
  isActive: boolean,
  sidebarCollapsed: boolean,
  disabled = false,
): SxProps<Theme> => (theme) => ({
  minWidth: sidebarCollapsed ? 0 : 36,
  color: isActive ? theme.palette.navigation.activeIcon : theme.palette.navigation.inactiveIcon,
  transition: NAVIGATION_TRANSITIONS.icon,
  opacity: disabled ? NAV_ITEM_DISABLED_OPACITY : 1,
  ...(disabled ? {} : {
    '.MuiListItemButton-root:hover &': {
      color: isActive ? theme.palette.navigation.activeIcon : theme.palette.navigation.inactiveHoverIcon,
    },
  }),
});

export const getNavigationTextProps = (isActive: boolean, disabled = false) => ({
  fontWeight: isActive ? 600 : 500,
  fontSize: '0.95rem',
  sx: (theme: Theme) => ({
    color: isActive ? theme.palette.navigation.activeText : theme.palette.navigation.inactiveText,
    opacity: disabled ? NAV_ITEM_DISABLED_OPACITY : 1,
    ...(disabled ? {} : {
      '.MuiListItemButton-root:hover &': {
        color: isActive ? theme.palette.navigation.activeText : theme.palette.navigation.inactiveHoverText,
      },
    }),
  }),
});

export const mobileNavigationDrawerPaperSx: SxProps<Theme> = (theme) => ({
  height: '100dvh',
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  bgcolor: theme.palette.surface.sidebarBackground,
  borderRight: '1px solid',
  borderColor: theme.palette.surface.surfaceBorder,
  overflow: 'hidden',
});

export const getMobileNavigationItemSx = (isActive: boolean, disabled = false): SxProps<Theme> => (theme) => ({
  justifyContent: 'flex-start',
  borderRadius: 0,
  px: 2,
  py: 1.5,
  color: isActive ? theme.palette.navigation.activeText : theme.palette.navigation.inactiveText,
  bgcolor: isActive ? theme.palette.navigation.activeBackground : 'transparent',
  transition: NAVIGATION_TRANSITIONS.item,
  ...(disabled
    ? { cursor: 'not-allowed', '&.Mui-disabled': { opacity: 1 } }
    : {
      '&:hover': {
        bgcolor: isActive ? theme.palette.navigation.activeHoverBackground : theme.palette.navigation.hoverBackground,
        color: isActive ? theme.palette.navigation.activeText : theme.palette.navigation.inactiveHoverText,
      },
    }),
});

export const getMobileNavigationTextProps = (isActive: boolean, disabled = false) => ({
  fontWeight: isActive ? 600 : 500,
  sx: (theme: Theme) => ({
    color: isActive ? theme.palette.navigation.activeText : theme.palette.navigation.inactiveText,
    opacity: disabled ? NAV_ITEM_DISABLED_OPACITY : 1,
    ...(disabled ? {} : {
      '.MuiListItemButton-root:hover &': {
        color: isActive ? theme.palette.navigation.activeText : theme.palette.navigation.inactiveHoverText,
      },
    }),
  }),
});

export const getMobileNavigationIconSx = (isActive: boolean, disabled = false): SxProps<Theme> => (theme) => ({
  minWidth: 36,
  color: isActive ? theme.palette.navigation.activeIcon : theme.palette.navigation.inactiveIcon,
  transition: NAVIGATION_TRANSITIONS.icon,
  opacity: disabled ? NAV_ITEM_DISABLED_OPACITY : 1,
  ...(disabled ? {} : {
    '.MuiListItemButton-root:hover &': {
      color: isActive ? theme.palette.navigation.activeIcon : theme.palette.navigation.inactiveHoverIcon,
    },
  }),
});
