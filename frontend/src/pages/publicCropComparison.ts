import type { TFunction } from 'i18next';
import type { Crop, PublicCrop } from '../api/types';
import { buildPublicCropUpdatePayload } from '../crops/publicCropFormAdapter';
import {
  arePublicValuesEqual,
  formatPublicCropValue,
  getPublicCropComparisonFieldLabel,
} from '../crop-library/components/publicCropLibrary/formatters';

export interface PublicCropChange {
  field: string;
  label: string;
  publicValue: string;
  privateValue: string;
}

const COMPARISON_FIELDS = [
  // `variety` leads the list because it is the entry's identity: since the
  // Sorte became editable on public entries, publishing an update rewrites it
  // like any other field, and leaving it out of the comparison made a rename
  // the one change the user could not see before confirming.
  'variety',
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
  'distance_within_row_m',
  'row_spacing_m',
  'sowing_depth_m',
  'seed_rate_value',
  'seed_rate_unit',
  'seed_rate_by_cultivation',
  'thousand_kernel_weight_g',
  'seeding_requirement',
  'seeding_requirement_type',
  'display_color',
  'seed_packages',
] as const;

export interface PublicCropComparisonOptions {
  /**
   * A species-level publish always writes an empty variety server-side, so the
   * entry's Sorte cannot change and must not be offered as a difference.
   */
  publishAsGeneral?: boolean;
}

export function buildPublicCropComparison(
  crop: Crop,
  publicCrop: PublicCrop,
  t: TFunction,
  options: PublicCropComparisonOptions = {},
): PublicCropChange[] {
  const privatePayload = buildPublicCropUpdatePayload(crop, publicCrop.version);
  const privateValues: Partial<PublicCrop> = privatePayload;
  const publicValues: Partial<PublicCrop> = publicCrop;
  return COMPARISON_FIELDS.flatMap((field) => {
    if (field === 'variety' && options.publishAsGeneral) return [];
    const privateValue = privateValues[field];
    const publicValue = publicValues[field];
    if (arePublicValuesEqual(privateValue, publicValue)) return [];
    return [{
      field,
      label: getPublicCropComparisonFieldLabel(field, t),
      publicValue: formatPublicCropValue(field, publicValue, t),
      privateValue: formatPublicCropValue(field, privateValue, t),
    }];
  });
}
