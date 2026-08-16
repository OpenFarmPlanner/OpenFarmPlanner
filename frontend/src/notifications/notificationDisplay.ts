/**
 * Turns a stored notification into what the UI shows and where it links.
 *
 * The backend deliberately ships `notification_type` + `context` instead of a
 * ready-made sentence (its own `message` field stays English for the admin and
 * non-UI consumers), so the localized text is assembled here.
 */

import type { TFunction } from 'i18next';
import type { AppNotification } from '../api/types';

export function getNotificationMessage(notification: AppNotification, t: TFunction): string {
  return t(`messages.${notification.notification_type}`, {
    ...notification.context,
    // An unknown type must never render a raw enum value at the user; the
    // English fallback text the backend already stored is the safer default.
    defaultValue: notification.message,
  });
}

/** In-app route for the referenced object, or `null` when there is nothing to open. */
export function getNotificationLink(notification: AppNotification): string | null {
  if (notification.target_id === null) {
    return null;
  }
  switch (notification.target_type) {
    case 'public_culture':
      return `/app/crop-library?cultureId=${notification.target_id}`;
    case 'crop_species':
      // Species have no detail route of their own; the library overview is the
      // closest place the decision is visible.
      return '/app/crop-library';
    default:
      return null;
  }
}
