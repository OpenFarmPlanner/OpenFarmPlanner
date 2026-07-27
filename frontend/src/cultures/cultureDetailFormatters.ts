/**
 * Storage key, persisted-filter shape, and pure value formatters for the
 * culture detail view. Extracted verbatim from cultures/CultureDetail.tsx.
 */

import type { Culture } from '../api/types';

export const CULTURE_FILTERS_STORAGE_KEY = 'culturesDetailFiltersV1';

export interface PersistedCultureFilters {
  searchQuery: string;
  selectedFamilyFilter: string;
  selectedCultivationFilter: string;
  selectedNutrientFilter: string;
  selectedSupplierFilter: string;
  growthDaysMin: string;
  growthDaysMax: string;
  yieldMin: string;
  yieldMax: string;
  selectedSowingMonths: number[];
}

/**
 * Formats a number with fallback for null/undefined values
 * Handles floating point precision issues by rounding to 2 decimal places
 */
export function formatNumber(value: number | null | undefined, t: (key: string) => string): string {
  if (value === null || value === undefined) {
    return t('cultures:noData');
  }
  
  // Round to 2 decimal places to avoid floating point precision issues
  const rounded = Math.round(value * 100) / 100;
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rounded);
}

export function formatSeedRateNumber(value: number | null | undefined, t: (key: string) => string): string {
  if (value === null || value === undefined) {
    return t('cultures:noData');
  }

  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(value);
}

/**
 * Formats a distance value (rounds to whole numbers since no one measures more precisely than 1cm)
 */
export function formatDistance(value: number | null | undefined, t: (key: string) => string, decimals = 0): string {
  if (value === null || value === undefined) {
    return t('cultures:noData');
  }

  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return rounded.toFixed(decimals);
}

/**
 * Derives the set of sowing months (1-12) for a culture, supporting the
 * month-array, single-month, and start/end-range shapes the API may provide.
 */
export function getSowingMonths(culture: Culture): number[] {
  const dynamicCulture = culture as Culture & {
    sowing_month?: number | null;
    sowing_months?: number[] | null;
    sowing_start_month?: number | null;
    sowing_end_month?: number | null;
  };
  if (Array.isArray(dynamicCulture.sowing_months)) {
    return dynamicCulture.sowing_months.filter((month) => Number.isInteger(month) && month >= 1 && month <= 12);
  }
  if (typeof dynamicCulture.sowing_month === 'number') {
    return dynamicCulture.sowing_month >= 1 && dynamicCulture.sowing_month <= 12 ? [dynamicCulture.sowing_month] : [];
  }
  if (typeof dynamicCulture.sowing_start_month === 'number' && typeof dynamicCulture.sowing_end_month === 'number') {
    const start = Math.min(dynamicCulture.sowing_start_month, dynamicCulture.sowing_end_month);
    const end = Math.max(dynamicCulture.sowing_start_month, dynamicCulture.sowing_end_month);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index).filter((month) => month >= 1 && month <= 12);
  }
  return [];
}

export function formatSeedUnitLabel(unit: string | null | undefined): string {
  if (unit === 'g_per_m2') return 'g / m²';
  if (unit === 'g_per_lfm') return 'g / lfm';
  if (unit === 'seeds_per_m2') return 'Korn / m²';
  if (unit === 'seeds_per_lfm') return 'Korn / lfm';
  if (unit === 'seeds_per_plant') return 'Korn / Pflanze';
  return unit ?? '';
}

export function formatPackageSizes(
  packageSizes: Array<{ size_value?: number | null; size_unit?: string | null }> | null | undefined,
  t: (key: string) => string,
): string {
  if (!Array.isArray(packageSizes) || packageSizes.length === 0) {
    return t('noData');
  }

  const normalized = packageSizes
    .filter((entry) => entry && typeof entry.size_value === 'number' && Number.isFinite(entry.size_value) && entry.size_value > 0)
    .map((entry) => `${formatNumber(entry.size_value ?? null, t)} ${entry.size_unit === 'seeds' ? 'Korn' : 'g'}`);

  if (normalized.length === 0) {
    return t('noData');
  }

  return normalized.join(', ');
}
