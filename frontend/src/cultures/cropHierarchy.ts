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
