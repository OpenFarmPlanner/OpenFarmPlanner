import type { PublicCulture } from '../api/types';

export interface PublicCultureFilterState {
  cropFamily: string;
  cultivationType: string;
  nutrientDemand: string;
  variety: string;
  growthDaysMin: string;
  growthDaysMax: string;
  yieldMin: string;
  yieldMax: string;
}

export const EMPTY_PUBLIC_CULTURE_FILTERS: PublicCultureFilterState = {
  cropFamily: '',
  cultivationType: '',
  nutrientDemand: '',
  variety: '',
  growthDaysMin: '',
  growthDaysMax: '',
  yieldMin: '',
  yieldMax: '',
};

export function countActivePublicCultureFilters(filters: PublicCultureFilterState): number {
  return Object.values(filters).filter(Boolean).length;
}

export interface PublicCultureFilterOptions {
  cropFamilyOptions: string[];
  varietyOptions: string[];
  nutrientOptions: string[];
}

export function getPublicCultureFilterOptions(cultures: readonly PublicCulture[]): PublicCultureFilterOptions {
  return {
    cropFamilyOptions: Array.from(new Set(cultures.map((entry) => entry.crop_family?.trim()).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
    varietyOptions: Array.from(new Set(cultures.map((entry) => entry.variety?.trim()).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
    nutrientOptions: Array.from(new Set(cultures.map((entry) => entry.nutrient_demand || '').filter(Boolean))).sort((a, b) => a.localeCompare(b)),
  };
}

/** Whether a single public culture entry matches the given attribute filters (text search is handled separately by each caller). */
export function matchesPublicCultureFilters(culture: PublicCulture, filters: PublicCultureFilterState): boolean {
  const parsedGrowthDaysMin = filters.growthDaysMin ? Number(filters.growthDaysMin) : null;
  const parsedGrowthDaysMax = filters.growthDaysMax ? Number(filters.growthDaysMax) : null;
  const parsedYieldMin = filters.yieldMin ? Number(filters.yieldMin) : null;
  const parsedYieldMax = filters.yieldMax ? Number(filters.yieldMax) : null;

  const familyMatches = !filters.cropFamily || (culture.crop_family || '') === filters.cropFamily;
  const varietyMatches = !filters.variety || (culture.variety || '') === filters.variety;
  const nutrientMatches = !filters.nutrientDemand || (culture.nutrient_demand || '') === filters.nutrientDemand;

  const cultivationValues = culture.cultivation_types && culture.cultivation_types.length > 0
    ? culture.cultivation_types
    : (culture.cultivation_type ? [culture.cultivation_type] : []);
  const cultivationMatches = (
    !filters.cultivationType
    || (filters.cultivationType === 'both'
      ? cultivationValues.includes('direct_sowing') && cultivationValues.includes('pre_cultivation')
      : cultivationValues.includes(filters.cultivationType as 'direct_sowing' | 'pre_cultivation'))
  );

  const growthValue = typeof culture.growth_duration_days === 'number' ? culture.growth_duration_days : null;
  const growthMatches = (
    (parsedGrowthDaysMin === null || (growthValue !== null && growthValue >= parsedGrowthDaysMin))
    && (parsedGrowthDaysMax === null || (growthValue !== null && growthValue <= parsedGrowthDaysMax))
  );

  const yieldValue = typeof culture.expected_yield === 'number' ? culture.expected_yield : null;
  const yieldMatches = (
    (parsedYieldMin === null || (yieldValue !== null && yieldValue >= parsedYieldMin))
    && (parsedYieldMax === null || (yieldValue !== null && yieldValue <= parsedYieldMax))
  );

  return familyMatches && varietyMatches && nutrientMatches && cultivationMatches && growthMatches && yieldMatches;
}
