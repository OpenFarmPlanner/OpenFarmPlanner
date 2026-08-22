import { useMemo, type ReactNode } from 'react';
import { Box, ListItemIcon, MenuItem, Typography } from '@mui/material';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import { useTranslation } from '../i18n';
import { formatRelativeTime } from '../utils/relativeTime';
import { ACTION_MENU_ICON_PROPS, ACTION_MENU_ITEM_ICON_SX } from '../navigation/topbarMenuStyles';
import { getNotificationMessage } from './notificationDisplay';
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
 * A hook returning an array rather than a component, because MUI's `Menu`
 * reads its direct children to drive keyboard navigation: a wrapping component
 * would hide these items from it.
 */
export function useNotificationMenuItems(
  controller: NotificationsController,
  onClose: () => void,
): ReactNode[] {
  const { t, i18n } = useTranslation('notifications');
  const selectNotification = useNotificationSelection(controller);
  const { notifications, hasError } = controller;
  const language = i18n.resolvedLanguage ?? i18n.language;

  // RootLayout calls this hook unconditionally on every render (MUI's Menu
  // needs the items as direct children, so this can't be skipped based on
  // isCompactTopbar), including on desktop where the result is thrown away
  // entirely — memoizing keeps that a no-op instead of rebuilding N MenuItem
  // elements with fresh inline closures each time.
  return useMemo(() => {
    if (hasError) {
      return [
        <MenuItem key="notifications-error" disabled sx={{ opacity: 1 }}>
          <Typography variant="body2" color="error.main" sx={{ whiteSpace: 'normal' }}>
            {t('bell.loadError')}
          </Typography>
        </MenuItem>,
      ];
    }

    if (notifications.length === 0) {
      return [
        <MenuItem key="notifications-empty" disabled sx={{ opacity: 1 }}>
          <Typography variant="body2" color="text.secondary">{t('bell.empty')}</Typography>
        </MenuItem>,
      ];
    }

    return notifications.map((notification) => (
      <MenuItem
        key={`notification-${notification.id}`}
        onClick={() => { onClose(); selectNotification(notification); }}
        sx={{ alignItems: 'flex-start', maxWidth: 320 }}
      >
        <ListItemIcon sx={ACTION_MENU_ITEM_ICON_SX}>
          <NotificationsNoneOutlinedIcon {...ACTION_MENU_ICON_PROPS} />
        </ListItemIcon>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{ whiteSpace: 'normal', fontWeight: notification.is_read ? 400 : 600 }}
          >
            {getNotificationMessage(notification, t)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatRelativeTime(notification.created_at, language)}
          </Typography>
        </Box>
      </MenuItem>
    ));
  }, [hasError, notifications, onClose, selectNotification, t, language]);
}
