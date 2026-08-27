import {
  getCropSpeciesKey,
  type CropHierarchyItem,
  type CropHierarchySource,
  withGroupGeneralCultures,
  withGroupSiblingCultures,
} from './cropHierarchy';

export function normalizeCultureGroupSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

interface FilterCultureGroupsForSearchOptions<TCulture extends CropHierarchySource> {
  cultures: readonly TCulture[];
  filterMatchingCultures: readonly TCulture[];
  normalizedSearchQuery: string;
  matchesSearchQuery: (culture: TCulture, normalizedSearchQuery: string) => boolean;
}

export interface CultureGroupSearchResult<TCulture extends CropHierarchySource> {
  searchMatchingCultures: TCulture[];
  matchingCultures: TCulture[];
  filteredCultures: TCulture[];
  matchedGroupRowIds: Set<string>;
}

/**
 * Applies the shared Kultur search behavior:
 * first search inside the already filter-matching rows, then widen any hit to
 * the whole Kultur group, and finally restore the group's general Kultur row
 * when the term only matched a Sorte.
 */
export function filterCultureGroupsForSearch<TCulture extends CropHierarchySource>({
  cultures,
  filterMatchingCultures,
  normalizedSearchQuery,
  matchesSearchQuery,
}: FilterCultureGroupsForSearchOptions<TCulture>): CultureGroupSearchResult<TCulture> {
  const searchMatchingCultures = normalizedSearchQuery
    ? filterMatchingCultures.filter((culture) => matchesSearchQuery(culture, normalizedSearchQuery))
    : [...filterMatchingCultures];

  const matchingCultures = normalizedSearchQuery
    ? withGroupSiblingCultures(searchMatchingCultures, filterMatchingCultures)
    : searchMatchingCultures;

  const filteredCultures = withGroupGeneralCultures(matchingCultures, cultures);

  const matchedGroupRowIds = normalizedSearchQuery
    ? new Set(searchMatchingCultures.map((culture) => `species:${getCropSpeciesKey(culture)}`))
    : new Set<string>();

  return {
    searchMatchingCultures,
    matchingCultures,
    filteredCultures,
    matchedGroupRowIds,
  };
}

export function getSearchMatchedHierarchyGroupRowIds<TCulture extends CropHierarchySource>(
  hierarchyItems: readonly CropHierarchyItem<TCulture>[],
  normalizedSearchQuery: string,
): Set<string> {
  return normalizedSearchQuery
    ? new Set(hierarchyItems.filter((item) => item.kind === 'species').map((item) => item.id))
    : new Set<string>();
}
