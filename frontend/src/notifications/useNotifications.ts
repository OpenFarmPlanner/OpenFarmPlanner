/**
 * Loads the signed-in user's notifications for the topbar bell.
 *
 * Fetched once on mount and again whenever the dropdown is opened, rather than
 * polled: notifications here are the outcome of a human moderation decision,
 * so a refresh on open is timely enough and costs one request instead of one
 * per interval for every open tab.
 */

import { useCallback, useEffect, useState } from 'react';
import { notificationAPI } from '../api/api';
import type { AppNotification } from '../api/types';

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

  const reload = useCallback((): void => {
    setReloadToken((token) => token + 1);
  }, []);

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

  return { notifications, unreadCount, isLoading, hasError, reload, markRead };
}
