import type { TFunction } from 'i18next';
import type { Culture, PublicCulture } from '../api/types';
import { buildPublicCultureUpdatePayload } from '../cultures/publicCultureFormAdapter';
import { arePublicValuesEqual } from '../crops/components/publicCropLibrary/formatters';

export interface PublicCultureChange {
  field: string;
  label: string;
  publicValue: string;
  privateValue: string;
}

const COMPARISON_FIELDS = [
  'notes',
  'crop_family',
  'nutrient_demand',
  'cultivation_type',
  'cultivation_types',
  'growth_duration_days',
  'harvest_duration_days',
  'propagation_duration_days',
  'harvest_method',
  'expected_yield',
  'allow_deviation_delivery_weeks',
  'distance_within_row_m',
  'row_spacing_m',
  'sowing_depth_m',
  'seed_rate_value',
  'seed_rate_unit',
  'seed_rate_by_cultivation',
  'sowing_calculation_safety_percent',
  'thousand_kernel_weight_g',
  'seeding_requirement',
  'seeding_requirement_type',
  'display_color',
  'seed_packages',
] as const;

type ComparisonField = (typeof COMPARISON_FIELDS)[number];

const normalizeValue = (value: unknown): unknown => {
  if (value === undefined || value === '') return null;
  if (Array.isArray(value)) return value.length ? [...value].sort() : null;
  return value;
};

const formatValue = (field: ComparisonField, value: unknown, t: TFunction): string => {
  const normalized = normalizeValue(value);
  if (normalized === null) return t('library.publishWizard.comparison.empty');
  if (typeof normalized === 'boolean') {
    return t(normalized ? 'library.publishWizard.comparison.yes' : 'library.publishWizard.comparison.no');
  }
  if (Array.isArray(normalized)) {
    return normalized.map((item) => {
      if (typeof item === 'object') return JSON.stringify(item);
      return t(`library.publishWizard.comparison.values.${String(item)}`, String(item));
    }).join(', ');
  }
  if (typeof normalized === 'object') return JSON.stringify(normalized);
  if (['nutrient_demand', 'harvest_method', 'seed_rate_unit', 'seeding_requirement_type'].includes(field)) {
    return t(`library.publishWizard.comparison.values.${String(normalized)}`, String(normalized));
  }
  return String(normalized);
};

export function buildPublicCultureComparison(
  culture: Culture,
  publicCulture: PublicCulture,
  t: TFunction,
): PublicCultureChange[] {
  const privatePayload = buildPublicCultureUpdatePayload(culture, publicCulture.version);
  const privateValues: Partial<PublicCulture> = privatePayload;
  const publicValues: Partial<PublicCulture> = publicCulture;
  return COMPARISON_FIELDS.flatMap((field) => {
    const privateValue = privateValues[field];
    const publicValue = publicValues[field];
    if (arePublicValuesEqual(privateValue, publicValue)) return [];
    return [{
      field,
      label: t(`library.publishWizard.comparison.fields.${field}`),
      publicValue: formatValue(field, publicValue, t),
      privateValue: formatValue(field, privateValue, t),
    }];
  });
}
