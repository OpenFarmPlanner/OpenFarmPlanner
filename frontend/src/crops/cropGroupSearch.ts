import {
  getCropSpeciesKey,
  type CropHierarchyItem,
  type CropHierarchySource,
  withGroupGeneralCrops,
  withGroupSiblingCrops,
} from './cropHierarchy';

export function normalizeCropGroupSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

interface FilterCropGroupsForSearchOptions<TCrop extends CropHierarchySource> {
  crops: readonly TCrop[];
  filterMatchingCrops: readonly TCrop[];
  normalizedSearchQuery: string;
  matchesSearchQuery: (crop: TCrop, normalizedSearchQuery: string) => boolean;
}

export interface CropGroupSearchResult<TCrop extends CropHierarchySource> {
  searchMatchingCrops: TCrop[];
  matchingCrops: TCrop[];
  filteredCrops: TCrop[];
  matchedGroupRowIds: Set<string>;
}

/**
 * Applies the shared Kultur search behavior:
 * first search inside the already filter-matching rows, then widen any hit to
 * the whole Kultur group, and finally restore the group's general Kultur row
 * when the term only matched a Sorte.
 */
export function filterCropGroupsForSearch<TCrop extends CropHierarchySource>({
  crops,
  filterMatchingCrops,
  normalizedSearchQuery,
  matchesSearchQuery,
}: FilterCropGroupsForSearchOptions<TCrop>): CropGroupSearchResult<TCrop> {
  const searchMatchingCrops = normalizedSearchQuery
    ? filterMatchingCrops.filter((crop) => matchesSearchQuery(crop, normalizedSearchQuery))
    : [...filterMatchingCrops];

  const matchingCrops = normalizedSearchQuery
    ? withGroupSiblingCrops(searchMatchingCrops, filterMatchingCrops)
    : searchMatchingCrops;

  const filteredCrops = withGroupGeneralCrops(matchingCrops, crops);

  const matchedGroupRowIds = normalizedSearchQuery
    ? new Set(searchMatchingCrops.map((crop) => `species:${getCropSpeciesKey(crop)}`))
    : new Set<string>();

  return {
    searchMatchingCrops,
    matchingCrops,
    filteredCrops,
    matchedGroupRowIds,
  };
}

export function getSearchMatchedHierarchyGroupRowIds<TCrop extends CropHierarchySource>(
  hierarchyItems: readonly CropHierarchyItem<TCrop>[],
  normalizedSearchQuery: string,
): Set<string> {
  return normalizedSearchQuery
    ? new Set(hierarchyItems.filter((item) => item.kind === 'species').map((item) => item.id))
    : new Set<string>();
}
