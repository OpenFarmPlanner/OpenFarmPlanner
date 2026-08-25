// Shared `sx` for the notification surfaces: the two dropdown entry points
// (topbar bell, compact "Mehr" menu) and the full history page.

import type { SxProps, Theme } from '@mui/material/styles';

/**
 * One notification row inside a dropdown. Deliberately tighter than a default
 * menu row: the dropdown lists only unread entries, so it should read as a
 * short glanceable stack rather than as a page.
 */
export const NOTIFICATION_DROPDOWN_ROW_SX: SxProps<Theme> = {
  alignItems: 'flex-start',
  display: 'block',
  px: 2,
  py: 0.75,
  borderBottom: '1px solid',
  borderColor: 'divider',
  '&:last-of-type': { borderBottom: 'none' },
};

/** The subtle "nothing new" hint that replaces the list when all is read. */
export const NOTIFICATION_HINT_SX: SxProps<Theme> = { px: 2, py: 1 };

/** Accent dot marking an unread row on the history page. */
export const NOTIFICATION_UNREAD_DOT_SX = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  flexShrink: 0,
  // Kept in the layout when read so switching a row to read does not shift its text.
  mt: 0.75,
} as const;
