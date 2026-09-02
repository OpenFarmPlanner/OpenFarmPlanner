import type { PublicCrop } from '../api/types';
import { normalizeCropGroupSearchQuery } from './cropGroupSearch';
import { getCropSpeciesLabel } from './cropHierarchy';

/**
 * The needle used by the public crop-library search, trimmed and lower-cased.
 * An empty result means "no search term" — every entry matches.
 */
export function normalizePublicCropSearchQuery(query: string): string {
  return normalizeCropGroupSearchQuery(query);
}

function publicCropSpeciesMatchesSearchQuery(
  crop: PublicCrop,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) {
    return true;
  }
  const speciesNames = [
    getCropSpeciesLabel(crop),
    crop.name,
    crop.crop_species_name,
    crop.crop_species_canonical_name,
    crop.display_name,
    ...Object.values(crop.crop_species_translations ?? {}),
    ...(crop.crop_species_search_names ?? []),
  ];
  return speciesNames.some((name) => (name ?? '').toLowerCase().includes(normalizedQuery));
}

function publicCropVarietyMatchesSearchQuery(
  crop: PublicCrop,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) {
    return true;
  }
  return (crop.variety ?? '').toLowerCase().includes(normalizedQuery);
}

/** A public crop-library row matches when its species name or variety contains the needle. */
export function publicCropMatchesSearchQuery(
  crop: PublicCrop,
  normalizedQuery: string,
): boolean {
  return publicCropSpeciesMatchesSearchQuery(crop, normalizedQuery)
    || publicCropVarietyMatchesSearchQuery(crop, normalizedQuery);
}
