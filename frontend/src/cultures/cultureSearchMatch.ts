import { getCultureDisplayName, type CultureDisplayFields } from './cultureDisplay';

/**
 * The needle used by the Kultur search, trimmed and lower-cased. An empty
 * result means "no search term" — every Kultur matches.
 */
export function normalizeCultureSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

function cultureNameMatchesSearchQuery(
  culture: CultureDisplayFields,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) {
    return true;
  }
  const displayName = getCultureDisplayName(culture).toLowerCase();
  const storedName = culture.name?.toLowerCase() ?? '';
  return displayName.includes(normalizedQuery) || storedName.includes(normalizedQuery);
}

function cultureVarietyMatchesSearchQuery(
  culture: CultureDisplayFields,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) {
    return true;
  }
  return (culture.variety?.toLowerCase() ?? '').includes(normalizedQuery);
}

/** A Kultur row matches when its own name or its Sorte name contains the needle. */
export function cultureMatchesSearchQuery(
  culture: CultureDisplayFields,
  normalizedQuery: string,
): boolean {
  return cultureNameMatchesSearchQuery(culture, normalizedQuery)
    || cultureVarietyMatchesSearchQuery(culture, normalizedQuery);
}
