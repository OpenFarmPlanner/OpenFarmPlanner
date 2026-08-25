/**
 * Loads the signed-in user's notifications for the topbar bell.
 *
 * Fetched once on mount and again whenever the dropdown is opened, rather than
 * polled: notifications here are the outcome of a human moderation decision,
 * so a refresh on open is timely enough and costs one request instead of one
 * per interval for every open tab.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { notificationAPI } from '../api/api';
import type { AppNotification } from '../api/types';
import { getNotificationLink } from './notificationDisplay';

export interface NotificationsController {
  notifications: AppNotification[];
  /** The subset the dropdowns render — see `NotificationBell`. */
  unreadNotifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  hasError: boolean;
  reload: () => void;
  markRead: (notification: AppNotification) => void;
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

  // Takes the notification rather than its id so the history page can mark a
  // row this controller never loaded (anything past the first page) and still
  // have the topbar badge follow along.
  const markRead = useCallback((notification: AppNotification): void => {
    if (notification.is_read) {
      return;
    }
    // Applied locally first so the badge reacts immediately; a failing request
    // only means the row reappears as unread on the next load.
    setNotifications((previous) => previous.map(
      (entry) => (entry.id === notification.id ? { ...entry, is_read: true } : entry),
    ));
    setUnreadCount((count) => Math.max(0, count - 1));
    void notificationAPI.markRead(notification.id).catch(() => undefined);
  }, []);

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.is_read),
    [notifications],
  );

  // Stable identity across renders that don't actually change any of these
  // fields, so consumers (NotificationBell, useNotificationMenuItems) can
  // memoize off the controller instead of re-deriving on every RootLayout
  // render.
  return useMemo(
    () => ({ notifications, unreadNotifications, unreadCount, isLoading, hasError, reload, markRead }),
    [notifications, unreadNotifications, unreadCount, isLoading, hasError, reload, markRead],
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
    markRead(notification);
    const link = getNotificationLink(notification);
    if (link) {
      void navigate(link);
    }
  }, [markRead, navigate]);
}
