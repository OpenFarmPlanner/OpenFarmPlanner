/**
 * Tracks a "later" dismissal of the first-run season setup dialog per project,
 * for the current browser session only (see docs/seasons-architecture.md).
 *
 * sessionStorage rather than localStorage: dismissing should survive an
 * accidental page reload within the same tab (the original bug — an in-memory
 * React state reset the dismissal on every reload), but still let the modal
 * come back on a genuinely new visit (new tab, browser restart), since
 * nothing about the underlying unassigned-plans state was actually decided.
 */

const storageKey = (projectId: number): string => `seasonSetupDismissed:${projectId}`;

export function isSeasonSetupDismissed(projectId: number): boolean {
  try {
    return window.sessionStorage.getItem(storageKey(projectId)) === 'true';
  } catch {
    return false;
  }
}

export function dismissSeasonSetup(projectId: number): void {
  try {
    window.sessionStorage.setItem(storageKey(projectId), 'true');
  } catch {
    // sessionStorage unavailable (e.g. private browsing) — dismissal just
    // won't survive a reload; the dialog is still fully usable.
  }
}
