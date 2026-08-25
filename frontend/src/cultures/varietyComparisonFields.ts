/**
 * Registry driving the Varieties comparison table in the Crop detail view.
 * Each entry describes one displayed value (backed by one or more Culture
 * fields), its label, and how to format it — so new fields can be added
 * here without touching the column-selection/rendering logic.
 */

import type { Culture, CultivationType } from '../api/types';
import {
  formatDistance,
  formatNumber,
} from './cultureDetailFormatters';
import { areCropValuesEqual, isEmptyCropValue } from './varietyValueSource';

type TranslateFn = (key: string) => string;

export interface CultureComparisonField {
  id: string;
  keys: (keyof Culture)[];
  labelKey: string;
  format: (culture: Culture, t: TranslateFn, locale: string) => string;
  /**
   * Overrides the default "effective value per key" resolution (variety's
   * own value for each of `keys`, falling back to the crop's) for fields
   * whose displayed value isn't a straight 1:1 mapping to `keys` — e.g.
   * seed safety margin, which is actually sourced from a cultivation-type
   * -specific field (direct/pre-cultivation), not the general one, mirroring
   * the resolution CultureDetail.tsx/CultureSeedDetails already do. Must
   * return values keyed exactly like `format` expects to read them.
   */
  resolveEffectiveValues?: (variety: Culture, cropCulture: Culture) => Partial<Culture>;
}

function getActiveCultivationTypes(culture: Culture): CultivationType[] {
  const types = culture.cultivation_types;
  if (types && types.length > 0) {
    return types;
  }
  return culture.cultivation_type ? [culture.cultivation_type] : [];
}

/**
 * The cultivation type(s) a culture effectively has: its own, or the crop's
 * when it has none of its own — same fallback as `activeCultivationTypes` in
 * CultureDetail.tsx.
 */
function getEffectiveCultivationTypes(culture: Culture, cropCulture: Culture): CultivationType[] {
  const ownTypes = getActiveCultivationTypes(culture);
  return ownTypes.length > 0 ? ownTypes : getActiveCultivationTypes(cropCulture);
}

export const CULTURE_COMPARISON_FIELDS: CultureComparisonField[] = [
  {
    id: 'cropFamily',
    keys: ['crop_family'],
    labelKey: 'form.cropFamily',
    format: (culture) => culture.crop_family || '',
  },
  {
    id: 'nutrientDemand',
    keys: ['nutrient_demand'],
    labelKey: 'form.nutrientDemand',
    format: (culture, t) => (
      culture.nutrient_demand === 'low'
        ? t('form.nutrientDemandLow')
        : culture.nutrient_demand === 'medium'
          ? t('form.nutrientDemandMedium')
          : culture.nutrient_demand === 'high'
            ? t('form.nutrientDemandHigh')
            : ''
    ),
  },
  {
    id: 'cultivationType',
    keys: ['cultivation_types', 'cultivation_type'],
    labelKey: 'form.cultivationType',
    format: (culture, t) => (
      getActiveCultivationTypes(culture)
        .map((item) => (
          item === 'pre_cultivation'
            ? t('form.cultivationTypePreCultivation')
            : t('form.cultivationTypeDirectSowing')
        ))
        .join(', ')
    ),
  },
  {
    id: 'growthDurationDays',
    keys: ['growth_duration_days'],
    labelKey: 'form.growthDurationDays',
    format: (culture, t, locale) => `${formatNumber(culture.growth_duration_days ?? null, t, locale)} ${t('detail.units.days')}`,
  },
  {
    id: 'harvestDurationDays',
    keys: ['harvest_duration_days'],
    labelKey: 'form.harvestDurationDays',
    format: (culture, t, locale) => `${formatNumber(culture.harvest_duration_days ?? null, t, locale)} ${t('detail.units.days')}`,
  },
  {
    id: 'propagationDurationDays',
    keys: ['propagation_duration_days'],
    labelKey: 'form.propagationDurationDays',
    format: (culture, t, locale) => `${formatNumber(culture.propagation_duration_days ?? null, t, locale)} ${t('detail.units.days')}`,
  },
  {
    id: 'distanceWithinRow',
    keys: ['distance_within_row_cm'],
    labelKey: 'detail.fields.distanceWithinRow',
    format: (culture, t, locale) => `${formatDistance(culture.distance_within_row_cm ?? null, t, locale)} ${t('detail.units.centimeters')}`,
  },
  {
    id: 'rowSpacing',
    keys: ['row_spacing_cm'],
    labelKey: 'detail.fields.rowSpacing',
    format: (culture, t, locale) => `${formatDistance(culture.row_spacing_cm ?? null, t, locale)} ${t('detail.units.centimeters')}`,
  },
  {
    id: 'sowingDepth',
    keys: ['sowing_depth_cm'],
    labelKey: 'detail.fields.sowingDepth',
    format: (culture, t, locale) => `${formatDistance(culture.sowing_depth_cm ?? null, t, locale, 1)} ${t('detail.units.centimeters')}`,
  },
  {
    id: 'seedSafetyMargin',
    // Bookkeeping only (which raw fields feed this value) — the actual
    // per-variety resolution lives in `resolveEffectiveValues` below, since
    // which of these three fields is "the" safety margin depends on the
    // culture's (effective) cultivation type.
    keys: [
      'sowing_calculation_safety_percent',
      'sowing_calculation_safety_percent_direct',
      'sowing_calculation_safety_percent_pre_cultivation',
    ],
    labelKey: 'detail.fields.seedSafetyMargin',
    format: (culture, t, locale) => `${formatNumber(culture.sowing_calculation_safety_percent ?? null, t, locale)} ${t('detail.units.percent')}`,
    resolveEffectiveValues: (variety, cropCulture) => {
      const effectiveTypes = getEffectiveCultivationTypes(variety, cropCulture);
      const key = effectiveTypes.length === 1
        ? (effectiveTypes[0] === 'direct_sowing' ? 'sowing_calculation_safety_percent_direct' : 'sowing_calculation_safety_percent_pre_cultivation')
        : 'sowing_calculation_safety_percent';
      const resolvedValue = getEffectiveValue(variety, cropCulture, key) as number | null | undefined;
      return { sowing_calculation_safety_percent: resolvedValue ?? undefined };
    },
  },
  {
    id: 'seedingRequirement',
    keys: ['seeding_requirement', 'seeding_requirement_type'],
    labelKey: 'detail.fields.seedingRequirement',
    format: (culture, t, locale) => {
      const amount = formatNumber(culture.seeding_requirement ?? null, t, locale);
      const suffix = culture.seeding_requirement_type === 'per_sqm'
        ? ` ${t('detail.seedingRequirementTypes.perSqm')}`
        : culture.seeding_requirement_type === 'per_plant'
          ? ` ${t('detail.seedingRequirementTypes.perPlant')}`
          : '';
      return `${amount}${suffix}`;
    },
  },
  {
    id: 'thousandKernelWeight',
    keys: ['thousand_kernel_weight_g'],
    labelKey: 'form.thousandKernelWeightLabel',
    format: (culture, t, locale) => `${formatNumber(culture.thousand_kernel_weight_g ?? null, t, locale)} ${t('detail.units.grams')}`,
  },
  {
    id: 'yieldUnit',
    keys: ['harvest_method'],
    labelKey: 'form.yieldUnit',
    format: (culture, t) => (
      culture.harvest_method === 'per_plant'
        ? t('form.yieldUnitPerPlant')
        : culture.harvest_method === 'per_sqm'
          ? t('form.yieldUnitPerSqm')
          : ''
    ),
  },
  {
    id: 'expectedYield',
    keys: ['expected_yield'],
    labelKey: 'form.expectedYield',
    format: (culture, t, locale) => `${formatNumber(culture.expected_yield ?? null, t, locale)} ${t('detail.units.kilograms')}`,
  },
];

const EMPTY_CELL_VALUE = '—';

/**
 * The value a variety effectively has for one Culture field: its own value
 * if it has one, otherwise the general crop's value — the same inherit
 * fallback used everywhere else in the detail view.
 */
function getEffectiveValue(variety: Culture, cropCulture: Culture, key: keyof Culture): unknown {
  const ownValue = variety[key];
  return isEmptyCropValue(ownValue) ? cropCulture[key] : ownValue;
}

/**
 * The effective values for one field/variety pair, keyed exactly like
 * `field.format` expects to read them — via `field.resolveEffectiveValues`
 * when the field defines one, otherwise the default per-key fallback.
 */
function resolveFieldValues(field: CultureComparisonField, variety: Culture, cropCulture: Culture): Partial<Culture> {
  if (field.resolveEffectiveValues) {
    return field.resolveEffectiveValues(variety, cropCulture);
  }

  const values: Record<string, unknown> = {};
  for (const key of field.keys) {
    values[key] = getEffectiveValue(variety, cropCulture, key);
  }
  return values as Partial<Culture>;
}

function fieldValuesDiffer(a: Partial<Culture>, b: Partial<Culture>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof Culture>;
  for (const key of keys) {
    if (!areCropValuesEqual(a[key], b[key])) {
      return true;
    }
  }
  return false;
}

/**
 * Fields where at least two of the given varieties end up with a genuinely
 * different *effective* value (own value, or the inherited crop value when
 * the variety has none) — i.e. the columns worth showing in the comparison
 * table. A field with fewer than two varieties, or where every variety
 * agrees (including two varieties inheriting the same crop value, or all
 * being empty on both variety and crop), is left out entirely rather than
 * shown with identical values in every row.
 */
export function getVaryingComparisonFields(varieties: Culture[], cropCulture: Culture): CultureComparisonField[] {
  if (varieties.length < 2) {
    return [];
  }

  const [reference, ...rest] = varieties;
  return CULTURE_COMPARISON_FIELDS.filter((field) => {
    const referenceValues = resolveFieldValues(field, reference, cropCulture);
    return rest.some((variety) => fieldValuesDiffer(referenceValues, resolveFieldValues(field, variety, cropCulture)));
  });
}

/**
 * Formats one table cell for a given variety/field pair. A variety with no
 * own value for a field still effectively has the general crop's value (the
 * same inherit fallback used everywhere else in the detail view), so that's
 * what's shown here — a plain em-dash (matching the rest of the app's
 * empty-value convention) only appears when neither the variety nor the
 * crop has a value for this field at all.
 */
export function getComparisonCellValue(
  variety: Culture,
  cropCulture: Culture,
  field: CultureComparisonField,
  t: TranslateFn,
  locale: string,
): string {
  const effective = resolveFieldValues(field, variety, cropCulture);
  const hasAnyValue = Object.values(effective).some((value) => !isEmptyCropValue(value));

  if (!hasAnyValue) {
    return EMPTY_CELL_VALUE;
  }

  return field.format({ ...variety, ...effective } as Culture, t, locale);
}
