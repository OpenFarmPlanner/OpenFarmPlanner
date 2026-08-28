import type { Culture, CultivationType, PublicCulture, SeedRateUnit } from '../api/types';
import { normalizeLanguageTag } from '../i18n/languages';
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

const publicCultureCentimeters = (
  centimeters: number | null | undefined,
  meters: number | null | undefined,
): number | undefined => (
  centimeters === null || centimeters === undefined ? centimetersFromMeters(meters) : centimeters
);

const metersFromCentimeters = (value: number | null | undefined): number | null => (
  value === null || value === undefined ? null : value / 100
);

const seedRateUnitOrNull = (value: unknown): SeedRateUnit | null => normalizeSeedRateUnit(value) ?? null;

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
      unit: seedRateUnitOrNull(culture.seed_rate_unit),
    };
  }
  return {};
};

const resolveCultivationTypes = (culture: PublicCulture): CultivationType[] => {
  if (culture.cultivation_types?.length) {
    return culture.cultivation_types;
  }
  return culture.cultivation_type ? [culture.cultivation_type] : ['pre_cultivation'];
};

const isCultivationType = (value: unknown): value is CultivationType => (
  value === 'pre_cultivation' || value === 'direct_sowing'
);

const resolveDraftCultivationTypes = (draft: Culture): CultivationType[] => {
  if (draft.cultivation_types && draft.cultivation_types.length > 0) {
    return draft.cultivation_types.filter(isCultivationType);
  }
  const normalized = normalizeCultivationType(draft.cultivation_type);
  return isCultivationType(normalized) ? [normalized] : ['pre_cultivation'];
};

export function publicCultureToCultureFormData(culture: PublicCulture): Culture {
  const cultivationTypes = resolveCultivationTypes(culture);
  const directRate = directSeedRate(culture, 'direct_sowing');
  const preCultivationRate = directSeedRate(culture, 'pre_cultivation');
  const originalLanguageCode = normalizeLanguageTag(culture.original_language_code) ?? '';
  const originalNotes = originalLanguageCode
    ? culture.translations?.[originalLanguageCode] ?? culture.notes ?? ''
    : culture.notes ?? '';

  return {
    id: culture.id,
    name: culture.name,
    variety: culture.variety ?? '',
    notes: originalNotes,
    crop_family: culture.crop_family ?? '',
    nutrient_demand: culture.nutrient_demand ?? '',
    cultivation_type: culture.cultivation_type || cultivationTypes[0] || 'pre_cultivation',
    cultivation_types: cultivationTypes,
    growth_duration_days: culture.growth_duration_days ?? undefined,
    harvest_duration_days: culture.harvest_duration_days ?? undefined,
    propagation_duration_days: culture.propagation_duration_days ?? undefined,
    harvest_method: culture.harvest_method ?? '',
    expected_yield: culture.expected_yield ?? undefined,
    distance_within_row_cm: publicCultureCentimeters(culture.distance_within_row_cm, culture.distance_within_row_m),
    row_spacing_cm: publicCultureCentimeters(culture.row_spacing_cm, culture.row_spacing_m),
    sowing_depth_cm: publicCultureCentimeters(culture.sowing_depth_cm, culture.sowing_depth_m),
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
  const cultivationTypes = resolveDraftCultivationTypes(draft);
  const seedRateFallbackFields = buildSeedRateByCultivation(
    draft,
    cultivationTypes,
    seedRateUnitOrNull(draft.seed_rate_unit),
    seedRateUnitOrNull(draft.seed_rate_direct_unit),
    seedRateUnitOrNull(draft.seed_rate_pre_cultivation_unit),
  );
  const sowingSafetyPercent = draft.sowing_calculation_safety_percent_direct
    ?? draft.sowing_calculation_safety_percent_pre_cultivation
    ?? draft.sowing_calculation_safety_percent
    ?? null;

  return {
    base_version: baseVersion,
    variety: draft.variety ?? '',
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
