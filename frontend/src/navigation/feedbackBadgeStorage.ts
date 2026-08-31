/**
 * Remembers that a user has opened the feedback dialog once, so the "new"
 * badge on the menu entry disappears for good. Namespaced per user like the
 * context-menu hints, so a shared device does not hide the badge for the next
 * account.
 */

const STORAGE_KEY_PREFIX = 'openfarmplanner.feedbackBadgeSeen';

const storageKey = (userId: number | null | undefined): string => (
  userId === null || userId === undefined
    ? STORAGE_KEY_PREFIX
    : `${STORAGE_KEY_PREFIX}:user:${userId}`
);

export function hasSeenFeedbackBadge(userId: number | null | undefined): boolean {
  if (typeof window === 'undefined') {
    return true;
  }
  return window.localStorage.getItem(storageKey(userId)) === '1';
}

export function markFeedbackBadgeSeen(userId: number | null | undefined): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(storageKey(userId), '1');
}
