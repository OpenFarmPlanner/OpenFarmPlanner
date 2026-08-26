import type { NotificationsController } from '../notifications/useNotifications';

/**
 * Shared types for the topbar action contract between the root layout and pages.
 *
 * Pages publish contextual actions into the persistent topbar via the outlet
 * context; the root layout renders them. Kept in a standalone module so pages
 * and hooks do not need to import the (heavy) root layout component.
 */

export interface TopbarContextAction {
  id: string;
  label: string;
  ariaLabel?: string;
  onClick: () => void;
  disabled?: boolean;
  shortcutHint?: string;
  active?: boolean;
  hidden?: boolean;
  reserveSpace?: boolean;
  groupId?: string;
  tooltip?: string;
  /**
   * 'segmented' (default) renders the compact pill style used for toggle groups and
   * quick topbar actions. 'standard' renders the app's standard outlined secondary
   * button (same border/color/typography/height/padding as DetailPageActions) for
   * standalone actions that should read as a normal secondary action, not a pill.
   */
  appearance?: 'segmented' | 'standard';
  menuActions?: Array<{ id: string; label: string; onClick: () => void; disabled?: boolean; destructive?: boolean }>;
  /** Small numeric badge rendered on the action's button, e.g. a pending-items count. Omitted/0 shows no badge. */
  badgeContent?: number;
}

export interface RootLayoutOutletContext {
  setTopbarContextActions: (actions: TopbarContextAction[]) => void;
  setTopbarTitleActions: (actions: TopbarContextAction[]) => void;
  /** Start year of the currently active season, once loaded; null while loading or without a project/season. */
  activeSeasonYear: number | null;
  /**
   * The single notification controller the topbar owns. Handed to pages so the
   * notification history page marks rows read through the same state the bell's
   * unread badge reads from, instead of a second copy that would drift.
   */
  notifications: NotificationsController;
}
