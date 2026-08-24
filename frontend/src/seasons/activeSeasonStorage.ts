/**
 * Persists the active season id per project, mirroring the `activeProjectId`
 * pattern in `AuthContext`/`httpClient` — namespaced by project so switching
 * projects never leaks a stale season id from a previous one.
 */

const storageKey = (projectId: number): string => `activeSeasonId:${projectId}`;

export function getStoredActiveSeasonId(projectId: number): number | null {
  const raw = window.localStorage.getItem(storageKey(projectId));
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function setStoredActiveSeasonId(projectId: number, seasonId: number): void {
  window.localStorage.setItem(storageKey(projectId), String(seasonId));
}

export function clearStoredActiveSeasonId(projectId: number): void {
  window.localStorage.removeItem(storageKey(projectId));
}
