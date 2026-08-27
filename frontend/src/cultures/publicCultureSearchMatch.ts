import type { PublicCulture } from '../api/types';
import { normalizeCultureGroupSearchQuery } from './cultureGroupSearch';
import { getCropSpeciesLabel } from './cropHierarchy';

/**
 * The needle used by the public crop-library search, trimmed and lower-cased.
 * An empty result means "no search term" — every entry matches.
 */
export function normalizePublicCultureSearchQuery(query: string): string {
  return normalizeCultureGroupSearchQuery(query);
}

function publicCultureSpeciesMatchesSearchQuery(
  culture: PublicCulture,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) {
    return true;
  }
  const speciesNames = [
    getCropSpeciesLabel(culture),
    culture.name,
    culture.crop_species_name,
    culture.crop_species_canonical_name,
    culture.display_name,
    ...Object.values(culture.crop_species_translations ?? {}),
    ...(culture.crop_species_search_names ?? []),
  ];
  return speciesNames.some((name) => (name ?? '').toLowerCase().includes(normalizedQuery));
}

function publicCultureVarietyMatchesSearchQuery(
  culture: PublicCulture,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) {
    return true;
  }
  return (culture.variety ?? '').toLowerCase().includes(normalizedQuery);
}

/** A public crop-library row matches when its species name or variety contains the needle. */
export function publicCultureMatchesSearchQuery(
  culture: PublicCulture,
  normalizedQuery: string,
): boolean {
  return publicCultureSpeciesMatchesSearchQuery(culture, normalizedQuery)
    || publicCultureVarietyMatchesSearchQuery(culture, normalizedQuery);
}
