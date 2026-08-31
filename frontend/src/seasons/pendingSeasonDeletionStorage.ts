/**
 * Briefly persists season deletions across the full-page reload that follows
 * deleting the *active* season (the app reloads so no page keeps stale
 * cross-season state — see docs/seasons-architecture.md). Without this the
 * undo snackbar would vanish on that reload. Session-scoped and self-expiring.
 */

export interface StoredSeasonDeletion {
  id: string;
  seasonId: number;
  message: string;
  /** Epoch ms after which the undo window has elapsed and the entry is dropped. */
  expiresAt: number;
  /** The deleted season was the active one, so undo must switch back to it. */
  restoreAsActive: boolean;
}

const STORAGE_KEY = 'pendingSeasonDeletions';

export function readPendingSeasonDeletions(): StoredSeasonDeletion[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as StoredSeasonDeletion[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    const now = Date.now();
    return parsed
      .filter((entry) => (
        typeof entry?.id === 'string'
        && typeof entry?.seasonId === 'number'
        && typeof entry?.expiresAt === 'number'
        && entry.expiresAt > now
      ))
      .map((entry) => ({ ...entry, restoreAsActive: Boolean(entry.restoreAsActive) }));
  } catch {
    return [];
  }
}

export function writePendingSeasonDeletions(entries: StoredSeasonDeletion[]): void {
  try {
    if (entries.length === 0) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // sessionStorage unavailable (private mode, quota) — the undo snackbar
    // just won't survive the reload, which is a graceful degradation.
  }
}
