/**
 * Loads the signed-in user's notifications for the topbar bell.
 *
 * Fetched once on mount, whenever the dropdown is opened, and when the
 * authenticated user's WebSocket stream reports that notifications changed.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { notificationAPI } from '../api/api';
import type { AppNotification } from '../api/types';
import { useWebSocket, type WebSocketEvent } from '../realtime/useWebSocket';
import { getNotificationLink } from './notificationDisplay';

export interface NotificationsController {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  hasError: boolean;
  reload: () => void;
  markRead: (id: number) => void;
}

export function useNotifications(enabled: boolean): NotificationsController {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback((): void => {
    setReloadToken((token) => token + 1);
  }, []);

  const handleNotificationEvent = useCallback((event: WebSocketEvent): void => {
    if (event.type === 'notifications.updated') {
      reload();
    }
  }, [reload]);

  useWebSocket({
    path: enabled ? 'ws/notifications/' : null,
    onEvent: handleNotificationEvent,
    onFallbackPoll: reload,
  });

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    let cancelled = false;
    // Deferred like the other loaders in this codebase so the fetch doesn't
    // set state synchronously inside the effect body.
    queueMicrotask(() => {
      if (!cancelled) setIsLoading(true);
    });
    notificationAPI.list()
      .then((response) => {
        if (cancelled) return;
        setNotifications(response.data.results);
        setUnreadCount(response.data.unread_count);
        setHasError(false);
      })
      .catch(() => {
        if (!cancelled) setHasError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, reloadToken]);

  const markRead = useCallback((id: number): void => {
    if (!notifications.some((notification) => notification.id === id && !notification.is_read)) {
      return;
    }
    // Applied locally first so the badge reacts immediately; a failing request
    // only means the row reappears as unread on the next load.
    setNotifications((previous) => previous.map(
      (notification) => (notification.id === id ? { ...notification, is_read: true } : notification),
    ));
    setUnreadCount((count) => Math.max(0, count - 1));
    void notificationAPI.markRead(id).catch(() => undefined);
  }, [notifications]);

  // Stable identity across renders that don't actually change any of these
  // fields, so consumers (NotificationBell, useNotificationMenuItems) can
  // memoize off the controller instead of re-deriving on every RootLayout
  // render.
  return useMemo(
    () => ({ notifications, unreadCount, isLoading, hasError, reload, markRead }),
    [notifications, unreadCount, isLoading, hasError, reload, markRead],
  );
}

/**
 * What clicking a single notification does, shared by the desktop bell and the
 * compact topbar's menu section: mark exactly that one as read, then open the
 * object it refers to (if it still has one).
 */
export function useNotificationSelection(
  controller: NotificationsController,
): (notification: AppNotification) => void {
  const navigate = useNavigate();
  const { markRead } = controller;

  return useCallback((notification: AppNotification): void => {
    markRead(notification.id);
    const link = getNotificationLink(notification);
    if (link) {
      void navigate(link);
    }
  }, [markRead, navigate]);
}
