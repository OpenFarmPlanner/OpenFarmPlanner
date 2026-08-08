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
}

function getActiveCultivationTypes(culture: Culture): CultivationType[] {
  const types = culture.cultivation_types;
  if (types && types.length > 0) {
    return types;
  }
  return culture.cultivation_type ? [culture.cultivation_type] : [];
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
    keys: ['sowing_calculation_safety_percent'],
    labelKey: 'detail.fields.seedSafetyMargin',
    format: (culture, t, locale) => `${formatNumber(culture.sowing_calculation_safety_percent ?? null, t, locale)} ${t('detail.units.percent')}`,
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
  {
    id: 'allowDeviationDeliveryWeeks',
    keys: ['allow_deviation_delivery_weeks'],
    labelKey: 'detail.fields.allowDeviationDeliveryWeeks',
    format: (culture, t) => (culture.allow_deviation_delivery_weeks ? t('detail.boolean.yes') : t('detail.boolean.no')),
  },
];

const EMPTY_CELL_VALUE = '—';

/**
 * Fields where at least two of the given varieties have a genuinely
 * different value — i.e. the columns worth showing in the comparison table.
 * A field with fewer than two varieties, or where every variety agrees
 * (including all being empty), is left out entirely rather than shown with
 * identical values in every row.
 */
export function getVaryingComparisonFields(varieties: Culture[]): CultureComparisonField[] {
  if (varieties.length < 2) {
    return [];
  }

  const [reference, ...rest] = varieties;
  return CULTURE_COMPARISON_FIELDS.filter((field) => (
    rest.some((variety) => field.keys.some((key) => !areCropValuesEqual(reference[key], variety[key])))
  ));
}

/**
 * Formats one table cell for a given variety/field pair, falling back to a
 * plain em-dash (matching the rest of the app's empty-value convention)
 * instead of a formatter-specific "not specified" string.
 */
export function getComparisonCellValue(
  culture: Culture,
  field: CultureComparisonField,
  t: TranslateFn,
  locale: string,
): string {
  const isEmpty = field.keys.every((key) => isEmptyCropValue(culture[key]));
  return isEmpty ? EMPTY_CELL_VALUE : field.format(culture, t, locale);
}
