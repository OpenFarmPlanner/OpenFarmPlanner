import type { Culture, PublicCulture } from '../api/types';

export type CropHierarchyItemKind = 'species' | 'variety';

export interface CropHierarchySource {
  id?: number;
  name: string;
  variety?: string | null;
  crop_species?: number | null;
  crop_species_name?: string | null;
  display_name?: string | null;
  culture_display_name?: string | null;
}

export interface CropHierarchyItem<TCulture extends CropHierarchySource> {
  id: string;
  parentId: string | null;
  kind: CropHierarchyItemKind;
  label: string;
  secondary: string;
  culture: TCulture | null;
  hasGeneralEntry: boolean;
  speciesKey: string;
  varietyCount: number;
}

const normalizeKey = (value: string | undefined | null): string => (
  (value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('de')
);

export const getCropSpeciesLabel = (culture: CropHierarchySource): string => (
  culture.culture_display_name
  || culture.display_name
  || culture.crop_species_name
  || culture.name
);

export const getCropSpeciesKey = (culture: CropHierarchySource): string => (
  culture.crop_species ? `species:${culture.crop_species}` : `name:${normalizeKey(getCropSpeciesLabel(culture))}`
);

export function buildCropHierarchy<TCulture extends CropHierarchySource>(
  cultures: readonly TCulture[],
): CropHierarchyItem<TCulture>[] {
  const groups = new Map<string, TCulture[]>();

  cultures.forEach((culture) => {
    const key = getCropSpeciesKey(culture);
    const group = groups.get(key);
    if (group) {
      group.push(culture);
    } else {
      groups.set(key, [culture]);
    }
  });

  return Array.from(groups.entries())
    .flatMap(([speciesKey, group]) => {
      const speciesCulture = group.find((culture) => !(culture.variety || '').trim()) ?? null;
      const speciesId = `species:${speciesKey}`;
      // Label falls back to group[0] purely for display text — but the node's `culture`
      // (its selection/edit identity) must stay null when there's no dedicated
      // general entry, or group[0] ends up rendered twice: once as a fake species
      // entry and once as its own variety row. Row rendering already treats
      // `culture: null` as "nothing to select here" (disabled={!culture}).
      const speciesLabel = getCropSpeciesLabel(speciesCulture ?? group[0]);
      const varietyCultures = group.filter((culture) => culture !== speciesCulture);
      const speciesNode: CropHierarchyItem<TCulture> = {
        id: speciesId,
        parentId: null,
        kind: 'species',
        label: speciesLabel,
        secondary: '',
        culture: speciesCulture,
        hasGeneralEntry: Boolean(speciesCulture),
        speciesKey,
        varietyCount: varietyCultures.length,
      };

      const varietyNodes = varietyCultures
        .map((culture) => ({
          id: `culture:${culture.id ?? `${speciesKey}:${culture.variety ?? culture.name}`}`,
          parentId: speciesId,
          kind: 'variety' as const,
          label: (culture.variety || '').trim() || getCropSpeciesLabel(culture),
          secondary: '',
          culture,
          hasGeneralEntry: true,
          speciesKey,
          varietyCount: 0,
        }));

      return [speciesNode, ...varietyNodes];
    });
}

/**
 * Adds back the general ("no variety") culture of every group the matches
 * belong to, so a filter that only hit Sorten still carries their Kultur.
 *
 * Searching for a variety name filters the general Kultur row out, which left
 * `buildCropHierarchy` with a species node that has no `culture` of its own:
 * clicking the Kultur in the tree then selected its first Sorte instead of
 * showing the Kultur's own data, and the search dropdown showed a variety row
 * without the Kultur it belongs to. The group's own header is context for the
 * matches, not a match itself, so it does not count towards "no results".
 */
export function withGroupGeneralCultures<TCulture extends CropHierarchySource>(
  matches: readonly TCulture[],
  allCultures: readonly TCulture[],
): TCulture[] {
  if (matches.length === 0) {
    return [...matches];
  }
  const matchedKeys = new Set<string>();
  const keysWithGeneralCulture = new Set<string>();
  matches.forEach((culture) => {
    const key = getCropSpeciesKey(culture);
    matchedKeys.add(key);
    if (!(culture.variety || '').trim()) {
      keysWithGeneralCulture.add(key);
    }
  });

  const missingGeneralCultures: TCulture[] = [];
  allCultures.forEach((culture) => {
    if ((culture.variety || '').trim()) {
      return;
    }
    const key = getCropSpeciesKey(culture);
    if (!matchedKeys.has(key) || keysWithGeneralCulture.has(key)) {
      return;
    }
    // Guards against a second varietyless row for the same group, which the UI
    // does not create but the data model allows.
    keysWithGeneralCulture.add(key);
    missingGeneralCultures.push(culture);
  });

  return missingGeneralCultures.length === 0
    ? [...matches]
    : [...matches, ...missingGeneralCultures];
}

/**
 * Widens per-Kultur matches to whole groups: a group counts as a hit as soon
 * as its Kultur name or any one of its Sorten matched, and it is then shown
 * with *all* of its Sorten rather than only the matching ones.
 *
 * Searching a Sorte name is a way of finding its Kultur, so hiding that
 * Kultur's remaining Sorten would answer a narrower question than the one the
 * user asked. `allCultures` is the set the other (non-search) filters already
 * left over, so a group is never widened past those filters.
 */
export function withGroupSiblingCultures<TCulture extends CropHierarchySource>(
  matches: readonly TCulture[],
  allCultures: readonly TCulture[],
): TCulture[] {
  if (matches.length === 0) {
    return [...matches];
  }
  const matchedKeys = new Set(matches.map((culture) => getCropSpeciesKey(culture)));
  return allCultures.filter((culture) => matchedKeys.has(getCropSpeciesKey(culture)));
}

/**
 * The first variety under a species node that has no dedicated varietyless
 * entry of its own (`hasGeneralEntry: false` on the species node — see
 * buildCropHierarchy). Such a species row has nothing to select directly, so
 * callers use this as the fallback target: select this variety (and expand
 * the group) instead of leaving the row inert/disabled.
 */
export function getFirstVarietyItem<TCulture extends CropHierarchySource>(
  items: readonly CropHierarchyItem<TCulture>[],
  speciesNodeId: string,
): CropHierarchyItem<TCulture> | null {
  return items.find((item) => item.parentId === speciesNodeId && item.culture !== null) ?? null;
}

export function findSpeciesCulture<TCulture extends CropHierarchySource>(
  culture: TCulture | null | undefined,
  cultures: readonly TCulture[],
): TCulture | null {
  if (!culture?.variety) {
    return null;
  }
  const speciesKey = getCropSpeciesKey(culture);
  return cultures.find((candidate) => (
    getCropSpeciesKey(candidate) === speciesKey
    && !(candidate.variety || '').trim()
  )) ?? null;
}

export type ProjectCropHierarchyItem = CropHierarchyItem<Culture>;
export type PublicCropHierarchyItem = CropHierarchyItem<PublicCulture>;
