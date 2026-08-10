/**
 * TODO: `window.confirm` is a native browser dialog — its button focus and
 * Enter/Escape behavior are controlled entirely by the browser/OS and can't
 * be made to follow the app's "default focus on Cancel, Enter never
 * confirms a destructive action" policy (see ConfirmationDialog). Prefer
 * `ConfirmationDialog` for new destructive confirmations; consider migrating
 * remaining `confirmAction` call sites (e.g. Locations.tsx, field/bed
 * operations) to it when touching that code.
 */
export function confirmAction(message: string): boolean {
  return window.confirm(message);
}
