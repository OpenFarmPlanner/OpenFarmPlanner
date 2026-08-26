/**
 * Loads the signed-in user's **unread** notifications for the topbar bell.
 *
 * Fetched once on mount and again whenever the dropdown is opened, rather than
 * polled: notifications here are the outcome of a human moderation decision,
 * so a refresh on open is timely enough and costs one request instead of one
 * per interval for every open tab.
 *
 * The unread filter is applied by the backend, not here: picking the unread
 * rows out of one page of the full history would show an empty dropdown next
 * to a non-zero badge as soon as the newest page holds no unread row. The full
 * archive lives on the history page (`useNotificationHistory`).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { notificationAPI } from '../api/api';
import type { AppNotification } from '../api/types';
import { getNotificationLink } from './notificationDisplay';

/** How many unread rows the dropdown loads; the badge always counts them all. */
export const NOTIFICATION_DROPDOWN_PAGE_SIZE = 20;

export interface NotificationsController {
  /** The loaded page of unread notifications, newest first. */
  notifications: AppNotification[];
  /**
   * The rows the dropdowns render: `notifications` minus the ones marked read
   * since the last load, so a clicked row disappears without a refetch.
   */
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
  // Ids whose mark-read request is in flight or done, so the same notification
  // reached through a second, independently loaded copy is a no-op.
  const markedReadIdsRef = useRef<Set<number>>(new Set());

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
    notificationAPI.list({ is_read: false, page_size: NOTIFICATION_DROPDOWN_PAGE_SIZE })
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
  // row this controller never loaded (anything past the dropdown's page) and
  // still have the topbar badge follow along. Because that caller's copy can be
  // stale — it was fetched separately and still says `is_read: false` — the ids
  // already handled are remembered here, so a second click on the same
  // notification cannot decrement the badge twice or re-POST.
  const markRead = useCallback((notification: AppNotification): void => {
    if (notification.is_read || markedReadIdsRef.current.has(notification.id)) {
      return;
    }
    markedReadIdsRef.current.add(notification.id);
    // Applied locally first so the badge reacts immediately; a failing request
    // only means the row reappears as unread on the next load, and is then
    // retryable again.
    setNotifications((previous) => previous.map(
      (entry) => (entry.id === notification.id ? { ...entry, is_read: true } : entry),
    ));
    setUnreadCount((count) => Math.max(0, count - 1));
    void notificationAPI.markRead(notification.id).catch(() => {
      markedReadIdsRef.current.delete(notification.id);
    });
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
  controller: NotificationsController | null,
): (notification: AppNotification) => void {
  const navigate = useNavigate();
  const markRead = controller?.markRead ?? null;

  return useCallback((notification: AppNotification): void => {
    if (markRead) {
      markRead(notification);
    } else if (!notification.is_read) {
      // Rendered without the topbar's controller (no badge to keep in sync);
      // the row itself still has to be marked read.
      void notificationAPI.markRead(notification.id).catch(() => undefined);
    }
    const link = getNotificationLink(notification);
    if (link) {
      void navigate(link);
    }
  }, [markRead, navigate]);
}
