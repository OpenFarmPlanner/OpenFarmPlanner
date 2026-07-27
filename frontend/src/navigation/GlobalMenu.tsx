import { Divider, ListItemIcon, Menu, MenuItem } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import KeyboardOutlinedIcon from '@mui/icons-material/KeyboardOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import LogoutIcon from '@mui/icons-material/Logout';
import { ACTION_MENU_ICON_PROPS, ACTION_MENU_ITEM_ICON_SX } from './topbarMenuStyles';

interface GlobalMenuProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  historyLoading: boolean;
  userLabel: string;
  isMobile: boolean;
  onClose: () => void;
  onOpenProjectSwitcher: () => void;
  onOpenCreateProject: () => void;
  onOpenProjectSettings: () => void;
  onOpenProjectHistory: () => Promise<void>;
  onOpenAccountSettings: () => void;
  onOpenShortcuts: () => void;
  onOpenHelp: () => void;
  canLeaveDemoProject: boolean;
  isGuestDemoSession: boolean;
  onLeaveDemoProject: () => Promise<void>;
  onLogout: () => Promise<void>;
  t: (key: string) => string;
}

export function GlobalMenu(props: GlobalMenuProps) {
  const {
    anchorEl,
    open,
    historyLoading,
    userLabel,
    isMobile,
    onClose,
    onOpenProjectSwitcher,
    onOpenCreateProject,
    onOpenProjectSettings,
    onOpenProjectHistory,
    onOpenAccountSettings,
    onOpenShortcuts,
    onOpenHelp,
    canLeaveDemoProject,
    isGuestDemoSession,
    onLeaveDemoProject,
    onLogout,
    t,
  } = props;

  const wrap = (fn: () => void): () => void => () => { onClose(); fn(); };
  const wrapAsync = (fn: () => Promise<void>): () => void => () => { onClose(); void fn(); };

  const mobileMenuItems = [
    <MenuItem key="mobile-section-project" disabled sx={{ opacity: 1, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('globalMenu.projectActions')}</MenuItem>,
    <MenuItem key="mobile-project-switcher" onClick={wrap(onOpenProjectSwitcher)}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><SwapHorizIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('projectSwitcher.ariaLabel')}</MenuItem>,
    <MenuItem key="mobile-project-create" onClick={wrap(onOpenCreateProject)}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><AddIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('project.create')}</MenuItem>,
    <MenuItem key="mobile-project-settings" onClick={wrap(onOpenProjectSettings)}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><SettingsOutlinedIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('project.settings')}</MenuItem>,
    <MenuItem key="mobile-project-history" onClick={wrapAsync(onOpenProjectHistory)} disabled={historyLoading}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><HistoryOutlinedIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('commandPalette.commands.openVersionHistory')}</MenuItem>,
    <Divider key="mobile-divider-project-app" />,
    <MenuItem key="mobile-section-app" disabled sx={{ opacity: 1, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('globalMenu.app')}</MenuItem>,
    <MenuItem key="mobile-app-shortcuts" onClick={wrap(onOpenShortcuts)}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><KeyboardOutlinedIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('globalMenu.shortcuts')}</MenuItem>,
    <MenuItem key="mobile-app-help" onClick={wrap(onOpenHelp)}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><HelpOutlineIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('globalMenu.appHelp')}</MenuItem>,
    <MenuItem key="mobile-app-account-settings" onClick={wrap(onOpenAccountSettings)}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><SettingsOutlinedIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('accountSettings')}</MenuItem>,
    <Divider key="mobile-divider-app-account" />,
    <MenuItem key="mobile-section-account" disabled sx={{ opacity: 1, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('globalMenu.account')}</MenuItem>,
    canLeaveDemoProject ? <MenuItem key="mobile-account-leave-demo" onClick={wrapAsync(onLeaveDemoProject)}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><ExitToAppIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('commandPalette.commands.leaveDemo')}</MenuItem> : null,
    !isGuestDemoSession ? <MenuItem key="mobile-account-logout" onClick={wrapAsync(onLogout)}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><LogoutIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('commandPalette.commands.logout')} {userLabel}</MenuItem> : null,
  ];
  const desktopMenuItems = [
    <MenuItem key="desktop-project-settings" onClick={wrap(onOpenProjectSettings)}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><SettingsOutlinedIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('project.settings')}</MenuItem>,
    <MenuItem key="desktop-history" onClick={wrapAsync(onOpenProjectHistory)} disabled={historyLoading}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><HistoryOutlinedIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('commandPalette.commands.openVersionHistory')}</MenuItem>,
    <Divider key="desktop-divider" />,
    <MenuItem key="desktop-account-settings" onClick={wrap(onOpenAccountSettings)}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><SettingsOutlinedIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('accountSettings')}</MenuItem>,
    <MenuItem key="desktop-shortcuts" onClick={wrap(onOpenShortcuts)}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><KeyboardOutlinedIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('globalMenu.shortcuts')}</MenuItem>,
    <MenuItem key="desktop-help" onClick={wrap(onOpenHelp)}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><HelpOutlineIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('globalMenu.appHelp')}</MenuItem>,
    canLeaveDemoProject ? <MenuItem key="desktop-leave-demo" onClick={wrapAsync(onLeaveDemoProject)}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><ExitToAppIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('commandPalette.commands.leaveDemo')}</MenuItem> : null,
    !isGuestDemoSession ? <MenuItem key="desktop-logout" onClick={wrapAsync(onLogout)}><ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}><LogoutIcon {...ACTION_MENU_ICON_PROPS} /></ListItemIcon>{t('commandPalette.commands.logout')} {userLabel}</MenuItem> : null,
  ];
  return <Menu id="global-actions-menu" anchorEl={anchorEl} open={open} onClose={onClose}>{isMobile ? mobileMenuItems : desktopMenuItems}</Menu>;
}
