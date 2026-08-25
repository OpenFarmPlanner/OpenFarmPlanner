import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ListItemIcon, MenuItem, Typography } from '@mui/material';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import { useTranslation } from '../i18n';
import { ACTION_MENU_ICON_PROPS, ACTION_MENU_ITEM_ICON_SX } from '../navigation/topbarMenuStyles';
import { NOTIFICATION_HISTORY_ROUTE } from './notificationDisplay';
import { NotificationItemContent } from './NotificationItemContent';
import { useNotificationSelection, type NotificationsController } from './useNotifications';

/**
 * The notification list as entries of the compact topbar's "Mehr" menu.
 *
 * The mobile topbar cannot afford a standalone bell — adding one squeezed the
 * page title down to a single letter on action-heavy pages — so on compact
 * widths notifications join the menu that already collapses the other
 * secondary actions. The unread count stays visible at a glance through the
 * badge on that menu's own button.
 *
 * Mirrors the bell one-for-one: unread entries only, a subtle hint when there
 * are none, and a permanent link to the full history.
 *
 * A hook returning an array rather than a component, because MUI's `Menu`
 * reads its direct children to drive keyboard navigation: a wrapping component
 * would hide these items from it.
 */
export function useNotificationMenuItems(
  controller: NotificationsController,
  onClose: () => void,
): ReactNode[] {
  const { t } = useTranslation('notifications');
  const navigate = useNavigate();
  const selectNotification = useNotificationSelection(controller);
  const { unreadNotifications, hasError } = controller;

  // RootLayout calls this hook unconditionally on every render (MUI's Menu
  // needs the items as direct children, so this can't be skipped based on
  // isCompactTopbar), including on desktop where the result is thrown away
  // entirely — memoizing keeps that a no-op instead of rebuilding N MenuItem
  // elements with fresh inline closures each time.
  return useMemo(() => {
    const showAllItem = (
      <MenuItem
        key="notifications-show-all"
        onClick={() => { onClose(); void navigate(NOTIFICATION_HISTORY_ROUTE); }}
      >
        <ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}>
          <ListAltOutlinedIcon {...ACTION_MENU_ICON_PROPS} />
        </ListItemIcon>
        <Typography variant="body2" color="primary.main">{t('bell.showAll')}</Typography>
      </MenuItem>
    );

    if (hasError) {
      return [
        <MenuItem key="notifications-error" disabled sx={{ opacity: 1 }}>
          <Typography variant="body2" color="error.main" sx={{ whiteSpace: 'normal' }}>
            {t('bell.loadError')}
          </Typography>
        </MenuItem>,
        showAllItem,
      ];
    }

    if (unreadNotifications.length === 0) {
      return [
        <MenuItem key="notifications-empty" disabled sx={{ opacity: 1 }}>
          <Typography variant="body2" color="text.secondary">{t('bell.noUnread')}</Typography>
        </MenuItem>,
        showAllItem,
      ];
    }

    return [
      ...unreadNotifications.map((notification) => (
        <MenuItem
          key={`notification-${notification.id}`}
          onClick={() => { onClose(); selectNotification(notification); }}
          sx={{ alignItems: 'flex-start', maxWidth: 320, py: 0.5 }}
        >
          <ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}>
            <NotificationsNoneOutlinedIcon {...ACTION_MENU_ICON_PROPS} />
          </ListItemIcon>
          <NotificationItemContent notification={notification} />
        </MenuItem>
      )),
      showAllItem,
    ];
  }, [hasError, navigate, onClose, selectNotification, t, unreadNotifications]);
}
