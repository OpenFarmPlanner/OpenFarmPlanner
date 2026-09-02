/**
 * Read-through migration for browser-storage keys renamed by Culture -> Crop.
 *
 * A returning user still has the pre-rename keys in their browser. Renaming the
 * constant without this would silently reset their selected crop and saved
 * filters and orphan the old entries forever, so the first read after the
 * rename adopts the old value and clears it.
 */

type WebStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Value under `key`, adopting `legacyKey`'s value the first time it is seen. */
export const readWithLegacyKey = (
  storage: WebStorage,
  key: string,
  legacyKey: string,
): string | null => {
  const current = storage.getItem(key);
  if (current !== null) {
    // The new key wins; a leftover under the old one is stale by definition.
    storage.removeItem(legacyKey);
    return current;
  }

  const legacy = storage.getItem(legacyKey);
  if (legacy === null) {
    return null;
  }

  storage.setItem(key, legacy);
  storage.removeItem(legacyKey);
  return legacy;
};

/**
 * Clear both spellings.
 *
 * Removing only the new key would let the next read-through resurrect the
 * pre-rename value the user just cleared.
 */
export const removeWithLegacyKey = (
  storage: WebStorage,
  key: string,
  legacyKey: string,
): void => {
  storage.removeItem(key);
  storage.removeItem(legacyKey);
};

/** Pre-"Crop" spelling of the crop-selection query parameter. */
export const LEGACY_CROP_ID_PARAM = 'cultureId';
export const CROP_ID_PARAM = 'cropId';

/**
 * The selected crop id from a URL, accepting the pre-rename parameter.
 *
 * Links to `?cultureId=` are out in the wild — bookmarks, notification
 * deep-links, pasted URLs — and silently ignoring them would drop the user on
 * an unselected page with no hint why.
 */
export const readCropIdParam = (params: URLSearchParams): string | null =>
  params.get(CROP_ID_PARAM) ?? params.get(LEGACY_CROP_ID_PARAM);

/** Whether either spelling of the crop-selection parameter is present. */
export const hasCropIdParam = (params: URLSearchParams): boolean =>
  params.has(CROP_ID_PARAM) || params.has(LEGACY_CROP_ID_PARAM);
