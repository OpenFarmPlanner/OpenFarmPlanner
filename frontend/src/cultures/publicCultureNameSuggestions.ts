import type { PublicCulture } from '../api/types';
import {
  findMatchedCropSpeciesAlias,
  formatCropSpeciesMatchLabel,
  getPublicCultureSpeciesSearchNames,
} from './cropSpeciesMatching';

export const normalizeIdentityValue = (value: string | undefined | null): string => (
  (value || '').trim().toLowerCase().replace(/\s+/g, ' ')
);

// Manual QA sessions occasionally publish throwaway entries directly to the
// public library (e.g. "Tomato · QA DE zweisprachig 1785241..."). Those rows
// are real, already-published data (not fixtures), so they are filtered out
// of suggestion sources here rather than deleted from the database.
const TEST_ENTRY_PATTERN = /\bqa\b|\btest\b/i;

export const isLikelyTestPublicCultureEntry = (culture: Pick<PublicCulture, 'name' | 'variety'>): boolean => (
  TEST_ENTRY_PATTERN.test(culture.name) || TEST_ENTRY_PATTERN.test(culture.variety || '')
);

export interface PublicCultureSpeciesOption {
  /** `crop_species` id when known, otherwise the normalized name (legacy entries without a species link). */
  key: number | string;
  cropSpeciesId: number | null;
  canonicalName: string;
  name: string;
  matchedAlias: string | null;
  searchNames: string[];
}

/**
 * Unique crop-species-level name suggestions derived from public culture
 * search results, e.g. for a "Name" field that must not show variety
 * combinations ("Tomato · Roma"). Grouped by `crop_species` id where
 * available, falling back to the normalized display name for legacy entries
 * without a species link.
 */
export const dedupePublicCulturesBySpecies = (
  cultures: PublicCulture[],
  searchValue = '',
): PublicCultureSpeciesOption[] => {
  const byKey = new Map<number | string, PublicCultureSpeciesOption>();

  for (const culture of cultures) {
    if (isLikelyTestPublicCultureEntry(culture)) {
      continue;
    }
    const canonicalName = culture.crop_species != null
      ? culture.crop_species_canonical_name || culture.display_name || culture.crop_species_name || culture.name || ''
      : culture.name || culture.display_name || culture.crop_species_name || '';
    const searchNames = getPublicCultureSpeciesSearchNames(culture);
    const matchedAlias = findMatchedCropSpeciesAlias(searchValue, canonicalName, searchNames);
    const name = formatCropSpeciesMatchLabel(canonicalName, matchedAlias);
    const key = culture.crop_species ?? normalizeIdentityValue(canonicalName);
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        cropSpeciesId: culture.crop_species ?? null,
        canonicalName,
        name,
        matchedAlias,
        searchNames,
      });
    }
  }

  return Array.from(byKey.values());
};

/**
 * Unique, non-empty variety names for a single crop species, filtered of
 * likely QA/test entries.
 */
export const dedupePublicCultureVarieties = (cultures: PublicCulture[]): string[] => {
  const varieties = new Set<string>();
  for (const culture of cultures) {
    const variety = (culture.variety || '').trim();
    if (!variety || isLikelyTestPublicCultureEntry(culture)) {
      continue;
    }
    varieties.add(variety);
  }
  return Array.from(varieties);
};
