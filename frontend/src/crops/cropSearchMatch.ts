import { getCropDisplayName, type CropDisplayFields } from './cropDisplay';
import { normalizeCropGroupSearchQuery } from './cropGroupSearch';

/**
 * The needle used by the Kultur search, trimmed and lower-cased. An empty
 * result means "no search term" — every Kultur matches.
 */
export function normalizeCropSearchQuery(query: string): string {
  return normalizeCropGroupSearchQuery(query);
}

function cropNameMatchesSearchQuery(
  crop: CropDisplayFields,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) {
    return true;
  }
  const displayName = getCropDisplayName(crop).toLowerCase();
  const storedName = crop.name?.toLowerCase() ?? '';
  return displayName.includes(normalizedQuery) || storedName.includes(normalizedQuery);
}

function cropVarietyMatchesSearchQuery(
  crop: CropDisplayFields,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) {
    return true;
  }
  return (crop.variety?.toLowerCase() ?? '').includes(normalizedQuery);
}

/** A Kultur row matches when its own name or its Sorte name contains the needle. */
export function cropMatchesSearchQuery(
  crop: CropDisplayFields,
  normalizedQuery: string,
): boolean {
  return cropNameMatchesSearchQuery(crop, normalizedQuery)
    || cropVarietyMatchesSearchQuery(crop, normalizedQuery);
}
