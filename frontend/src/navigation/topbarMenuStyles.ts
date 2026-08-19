// Shared styling for the topbar action menus (ProjectMenu, GlobalMenu):
// the leading icon column and the icon size used inside their menu items.

export const ACTION_MENU_ITEM_ICON_SX = { minWidth: 32, color: 'text.secondary' } as const;
export const ACTION_MENU_ICON_PROPS = { fontSize: 'small' } as const;

// Count badges anchored to a topbar IconButton (moderation queue, "Mehr"/more
// actions, the notification bell). MUI's default anchor centers the badge on
// the button's top edge, which sits close enough to the very top of the page
// that half the badge pokes past it; nudging the anchor down keeps it a
// complete, unclipped circle. See commit a2a2f6fd for why the ancestors'
// `overflow` can't be the fix instead.
export const TOPBAR_BADGE_SX = { '& .MuiBadge-badge': { top: 6 } } as const;
