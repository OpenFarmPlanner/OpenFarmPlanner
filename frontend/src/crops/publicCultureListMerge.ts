import type { PublicCulture } from '../api/types';

/**
 * Keeps locally saved cultures from being rolled back by a list response that
 * predates the save.
 *
 * The page already discards list requests that were in flight when a save
 * landed, but a request started *after* the save — the search box refreshes on
 * a debounce — still carries pre-save data and would otherwise write the old
 * values straight back over the saved ones.
 *
 * An entry is dropped from `saved` as soon as the server returns that culture
 * at the saved version or newer, so an override never outlives the request it
 * was protecting against and later server-side edits still win.
 */
export function applySavedCultures(
  results: PublicCulture[],
  saved: Map<number, PublicCulture>,
): PublicCulture[] {
  if (saved.size === 0) {
    return results;
  }

  return results.map((culture) => {
    const savedCulture = saved.get(culture.id);
    if (!savedCulture) {
      return culture;
    }
    if (culture.version >= savedCulture.version) {
      saved.delete(culture.id);
      return culture;
    }
    return savedCulture;
  });
}
