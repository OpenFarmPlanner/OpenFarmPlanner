import type { Culture, CultivationType, PublicCulture, SeedRateUnit } from '../api/types';
import {
  normalizeCultivationType,
  normalizeHarvestMethod,
  normalizeNutrientDemand,
  normalizeSeedingRequirementType,
  normalizeSeedRateUnit,
} from './enumNormalization';
import { buildSeedRateByCultivation } from './seedRatePayload';

const centimetersFromMeters = (value: number | null | undefined): number | undefined => (
  value === null || value === undefined ? undefined : Math.round(value * 100)
);

const metersFromCentimeters = (value: number | null | undefined): number | null => (
  value === null || value === undefined ? null : value / 100
);

const directSeedRate = (
  culture: PublicCulture,
  type: CultivationType,
): { value?: number | null; unit?: SeedRateUnit | null } => {
  const methodSpecific = culture.seed_rate_by_cultivation?.[type];
  if (methodSpecific) {
    return methodSpecific;
  }
  if (culture.cultivation_type === type || culture.cultivation_types?.includes(type)) {
    return {
      value: culture.seed_rate_value ?? null,
      unit: normalizeSeedRateUnit(culture.seed_rate_unit) ?? null,
    };
  }
  return {};
};

export function publicCultureToCultureFormData(culture: PublicCulture): Culture {
  const cultivationTypes: CultivationType[] = culture.cultivation_types?.length
    ? culture.cultivation_types
    : (culture.cultivation_type ? [culture.cultivation_type] : ['pre_cultivation']);
  const directRate = directSeedRate(culture, 'direct_sowing');
  const preCultivationRate = directSeedRate(culture, 'pre_cultivation');

  return {
    id: culture.id,
    name: culture.name,
    variety: culture.variety ?? '',
    notes: culture.notes ?? '',
    crop_family: culture.crop_family ?? '',
    nutrient_demand: culture.nutrient_demand ?? '',
    cultivation_type: culture.cultivation_type || cultivationTypes[0] || 'pre_cultivation',
    cultivation_types: cultivationTypes,
    growth_duration_days: culture.growth_duration_days ?? undefined,
    harvest_duration_days: culture.harvest_duration_days ?? undefined,
    propagation_duration_days: culture.propagation_duration_days ?? undefined,
    harvest_method: culture.harvest_method ?? '',
    expected_yield: culture.expected_yield ?? undefined,
    allow_deviation_delivery_weeks: Boolean(culture.allow_deviation_delivery_weeks),
    distance_within_row_cm: centimetersFromMeters(culture.distance_within_row_m),
    row_spacing_cm: centimetersFromMeters(culture.row_spacing_m),
    sowing_depth_cm: centimetersFromMeters(culture.sowing_depth_m),
    seed_rate_value: culture.seed_rate_value ?? null,
    seed_rate_unit: normalizeSeedRateUnit(culture.seed_rate_unit),
    seed_rate_by_cultivation: culture.seed_rate_by_cultivation ?? null,
    seed_rate_direct_value: directRate.value ?? null,
    seed_rate_direct_unit: normalizeSeedRateUnit(directRate.unit),
    sowing_calculation_safety_percent_direct: culture.sowing_calculation_safety_percent ?? null,
    seed_rate_pre_cultivation_value: preCultivationRate.value ?? null,
    seed_rate_pre_cultivation_unit: normalizeSeedRateUnit(preCultivationRate.unit),
    sowing_calculation_safety_percent_pre_cultivation: culture.sowing_calculation_safety_percent ?? null,
    sowing_calculation_safety_percent: culture.sowing_calculation_safety_percent ?? undefined,
    thousand_kernel_weight_g: culture.thousand_kernel_weight_g ?? undefined,
    seeding_requirement: culture.seeding_requirement ?? undefined,
    seeding_requirement_type: culture.seeding_requirement_type ?? '',
    display_color: culture.display_color ?? '',
    seed_packages: culture.seed_packages ?? [],
  };
}

export function buildPublicCultureUpdatePayload(
  draft: Culture,
  baseVersion: number,
): Partial<PublicCulture> & { base_version: number } {
  const cultivationTypes: CultivationType[] = (draft.cultivation_types && draft.cultivation_types.length > 0)
    ? draft.cultivation_types.filter((value): value is CultivationType => value === 'pre_cultivation' || value === 'direct_sowing')
    : (draft.cultivation_type ? [normalizeCultivationType(draft.cultivation_type)].filter((value): value is CultivationType => Boolean(value)) : ['pre_cultivation']);
  const seedRateFallbackFields = buildSeedRateByCultivation(
    draft,
    cultivationTypes,
    normalizeSeedRateUnit(draft.seed_rate_unit) ?? null,
    normalizeSeedRateUnit(draft.seed_rate_direct_unit) ?? null,
    normalizeSeedRateUnit(draft.seed_rate_pre_cultivation_unit) ?? null,
  );
  const sowingSafetyPercent = draft.sowing_calculation_safety_percent_direct
    ?? draft.sowing_calculation_safety_percent_pre_cultivation
    ?? draft.sowing_calculation_safety_percent
    ?? null;

  return {
    base_version: baseVersion,
    name: draft.name.trim(),
    variety: draft.variety?.trim() ?? '',
    notes: draft.notes ?? '',
    crop_family: draft.crop_family ?? '',
    nutrient_demand: normalizeNutrientDemand(draft.nutrient_demand),
    cultivation_type: normalizeCultivationType(draft.cultivation_type),
    cultivation_types: cultivationTypes,
    growth_duration_days: draft.growth_duration_days ?? null,
    harvest_duration_days: draft.harvest_duration_days ?? null,
    propagation_duration_days: draft.propagation_duration_days ?? null,
    harvest_method: normalizeHarvestMethod(draft.harvest_method),
    expected_yield: draft.expected_yield ?? null,
    allow_deviation_delivery_weeks: Boolean(draft.allow_deviation_delivery_weeks),
    distance_within_row_m: metersFromCentimeters(draft.distance_within_row_cm),
    row_spacing_m: metersFromCentimeters(draft.row_spacing_cm),
    sowing_depth_m: metersFromCentimeters(draft.sowing_depth_cm),
    seed_rate_value: seedRateFallbackFields.seed_rate_value,
    seed_rate_unit: seedRateFallbackFields.seed_rate_unit,
    seed_rate_by_cultivation: seedRateFallbackFields.seed_rate_by_cultivation,
    sowing_calculation_safety_percent: sowingSafetyPercent,
    thousand_kernel_weight_g: draft.thousand_kernel_weight_g ?? null,
    seeding_requirement: draft.seeding_requirement ?? null,
    seeding_requirement_type: normalizeSeedingRequirementType(draft.seeding_requirement_type),
    display_color: draft.display_color ?? '',
    seed_packages: draft.seed_packages ?? [],
  };
}
