import { useState, type MouseEvent } from 'react';
import {
  Badge,
  Box,
  CircularProgress,
  Divider,
  IconButton,
  ListItemButton,
  Menu,
  Typography,
} from '@mui/material';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import { AppTooltip } from '../components/AppTooltip';
import { useTranslation } from '../i18n';
import { formatRelativeTime } from '../utils/relativeTime';
import { getNotificationMessage } from './notificationDisplay';
import { useNotificationSelection, type NotificationsController } from './useNotifications';
import { TOPBAR_BADGE_SX } from '../navigation/topbarMenuStyles';
import type { AppNotification } from '../api/types';

interface NotificationBellProps {
  controller: NotificationsController;
  /** Topbar icon buttons share one square size; passed in so the bell matches its neighbours. */
  buttonSize?: number;
}

/**
 * Topbar bell with an unread badge and a dropdown of the user's notifications.
 *
 * Only rendered on the full topbar. The compact topbar has no room for another
 * icon next to the page actions (it collapsed the page title to a single
 * letter), so there the same notifications live inside the "Mehr" menu — see
 * `useNotificationMenuItems`.
 *
 * Opening the menu deliberately marks nothing as read — only clicking a single
 * entry does, which then navigates to the object the notification is about.
 */
export function NotificationBell({ controller, buttonSize }: NotificationBellProps) {
  const { t, i18n } = useTranslation('notifications');
  const [anchorElement, setAnchorElement] = useState<null | HTMLElement>(null);
  const isOpen = Boolean(anchorElement);
  const { notifications, unreadCount, isLoading, hasError, reload } = controller;
  const selectNotification = useNotificationSelection(controller);
  const language = i18n.resolvedLanguage ?? i18n.language;

  const handleOpen = (event: MouseEvent<HTMLElement>): void => {
    setAnchorElement(event.currentTarget);
    reload();
  };

  const handleSelect = (notification: AppNotification): void => {
    setAnchorElement(null);
    selectNotification(notification);
  };

  const label = unreadCount > 0
    // Named `unread` rather than `count` on purpose: an i18next `count`
    // switches the key into plural resolution, which these two bundles do not
    // define suffixes for.
    ? t('bell.unreadAriaLabel', { unread: unreadCount })
    : t('bell.ariaLabel');

  return (
    <>
      <AppTooltip title={t('bell.title')} enterTouchDelay={0}>
        <IconButton
          aria-label={label}
          aria-haspopup="true"
          aria-expanded={isOpen}
          onClick={handleOpen}
          size="small"
          sx={{
            color: 'text.primary',
            flexShrink: 0,
            ...(buttonSize ? { width: buttonSize, height: buttonSize } : {}),
          }}
        >
          <Badge badgeContent={unreadCount} color="error" overlap="circular" sx={TOPBAR_BADGE_SX}>
            <NotificationsNoneOutlinedIcon fontSize="small" />
          </Badge>
        </IconButton>
      </AppTooltip>
      <Menu
        anchorEl={anchorElement}
        open={isOpen}
        onClose={() => setAnchorElement(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { mt: 0.5, width: { xs: 280, sm: 360 }, maxWidth: '100vw' } } }}
      >
        <Typography variant="subtitle2" sx={{ px: 2, py: 1 }}>
          {t('bell.title')}
        </Typography>
        <Divider />
        {isLoading && notifications.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={20} />
          </Box>
        ) : null}
        {hasError ? (
          <Typography variant="body2" color="error.main" sx={{ px: 2, py: 1.5 }}>
            {t('bell.loadError')}
          </Typography>
        ) : null}
        {!isLoading && !hasError && notifications.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1.5 }}>
            {t('bell.empty')}
          </Typography>
        ) : null}
        {notifications.map((notification) => (
          <ListItemButton
            key={notification.id}
            onClick={() => handleSelect(notification)}
            sx={{
              alignItems: 'flex-start',
              display: 'block',
              px: 2,
              py: 1.25,
              borderBottom: '1px solid',
              borderColor: 'divider',
              '&:last-of-type': { borderBottom: 'none' },
            }}
          >
            <Typography
              variant="body2"
              sx={{ whiteSpace: 'normal', fontWeight: notification.is_read ? 400 : 600 }}
            >
              {getNotificationMessage(notification, t)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatRelativeTime(notification.created_at, language)}
            </Typography>
          </ListItemButton>
        ))}
      </Menu>
    </>
  );
}
