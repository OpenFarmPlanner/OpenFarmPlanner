import type { Culture, CultureInheritableField } from '../api/types';

export type CropValueSource = 'ownValue' | null;

export const isEmptyCropValue = (value: unknown): boolean => (
  value === null
  || value === undefined
  || value === ''
  || (Array.isArray(value) && value.length === 0)
);

export const areCropValuesEqual = (left: unknown, right: unknown): boolean => {
  if (isEmptyCropValue(left) && isEmptyCropValue(right)) {
    return true;
  }
  if (typeof left === 'number' && typeof right === 'number') {
    return Math.abs(left - right) < Number.EPSILON;
  }
  if (Array.isArray(left) || Array.isArray(right) || (typeof left === 'object' && left !== null) || (typeof right === 'object' && right !== null)) {
    return JSON.stringify(left) === JSON.stringify(right);
  }
  return left === right;
};

/**
 * Determines whether `field` holds a variety-specific value that overrides the
 * parent species culture's value. Shared between the detail view and the edit
 * form so both use the same override/inherited concept.
 */
/**
 * Culture fields that a new variety can usefully start out with, copied from
 * its general crop, when the user opens "Add variety". Deliberately excludes
 * identity/free-text fields (name, variety, notes) and per-variety data that
 * should never default to the crop's own (color, supplier/seed packaging).
 */
export const VARIETY_INHERITABLE_FIELDS: (keyof Culture)[] = [
  'crop_family',
  'nutrient_demand',
  'rotation_break_years',
  'cultivation_type',
  'cultivation_types',
  'growth_duration_days',
  'harvest_duration_days',
  'propagation_duration_days',
  'harvest_method',
  'expected_yield',
  'distance_within_row_cm',
  'row_spacing_cm',
  'sowing_depth_cm',
  'sowing_calculation_safety_percent',
  'sowing_calculation_safety_percent_direct',
  'sowing_calculation_safety_percent_pre_cultivation',
  'thousand_kernel_weight_g',
  'seeding_requirement',
  'seeding_requirement_type',
  'seed_rate_direct_value',
  'seed_rate_direct_unit',
  'seed_rate_pre_cultivation_value',
  'seed_rate_pre_cultivation_unit',
];

/**
 * Builds the prefill values for a new variety's form: every inheritable
 * field the crop actually has a value for. Left out of the result entirely
 * (rather than copied as empty) when the crop itself has no value, so the
 * form doesn't overwrite the form's own empty defaults with more emptiness.
 */
export function buildVarietyInheritanceBaseline(cropCulture: Culture): Partial<Culture> {
  const baseline: Partial<Culture> = {};
  for (const field of VARIETY_INHERITABLE_FIELDS) {
    const value = cropCulture[field];
    if (!isEmptyCropValue(value)) {
      (baseline as Record<string, unknown>)[field] = value;
    }
  }
  return baseline;
}

/**
 * Given a saved variety draft and the crop baseline it was prefilled from,
 * returns a copy with any field that still matches the crop's value cleared
 * back out — so a variety the user didn't actually change from its prefilled
 * defaults keeps inheriting from the crop (including future crop edits)
 * instead of silently freezing a duplicate copy of today's crop values.
 */
export function stripValuesMatchingBaseline<TDraft extends Partial<Culture>>(
  draft: TDraft,
  baseline: Partial<Culture>,
  emptyValueFor: (field: keyof Culture) => unknown,
): TDraft {
  const stripped: Record<string, unknown> = { ...draft };
  for (const field of VARIETY_INHERITABLE_FIELDS) {
    if (!(field in baseline)) {
      continue;
    }
    if (areCropValuesEqual(stripped[field], baseline[field])) {
      stripped[field] = emptyValueFor(field);
    }
  }
  return stripped as TDraft;
}

/**
 * The values the backend resolved from a Sorte's general Kultur, keyed by form
 * field. The edit dialog merges these into the form so a field the Sorte does
 * not override shows the Kultur's value instead of an empty input; it is also
 * the baseline `stripValuesMatchingBaseline` clears again on save, so merely
 * displaying an inherited value never turns it into an override.
 *
 * Empty when there is nothing to inherit from — a general Kultur, or a
 * free-text Sorte without a linked crop species.
 */
export function buildInheritedValueBaseline(
  culture: Culture | null | undefined,
): Partial<Culture> {
  if (!culture?.general_culture) {
    return {};
  }
  const effectiveValues = culture.effective_values;
  if (!effectiveValues) {
    return {};
  }
  const baseline: Partial<Culture> = {};
  for (const field of culture.inherited_fields ?? []) {
    const value = effectiveValues[field];
    if (!isEmptyCropValue(value)) {
      (baseline as Record<string, unknown>)[field] = value;
    }
  }
  return baseline;
}

/**
 * The value a culture effectively plans with: its own, or — for a Sorte that
 * leaves the field unset — the one the backend resolved from its general
 * Kultur. Falls back to the raw field for cultures with nothing to inherit
 * from (a general Kultur, a free-text Sorte, or a stale client-side object
 * that predates the inheritance payload).
 */
export function getEffectiveCultureValue<TField extends CultureInheritableField>(
  culture: Partial<Culture> | null | undefined,
  field: TField,
): Culture[TField] {
  const effectiveValue = culture?.effective_values?.[field];
  return (effectiveValue ?? culture?.[field]) as Culture[TField];
}

export function getVarietyOwnValueSource(
  culture: Partial<Culture> | null | undefined,
  speciesCulture: Partial<Culture> | null | undefined,
  field: keyof Culture,
): CropValueSource {
  if (!culture?.variety || !speciesCulture) {
    return null;
  }
  const ownValue = culture[field];
  if (isEmptyCropValue(ownValue)) {
    return null;
  }
  const cropValue = speciesCulture[field];
  return areCropValuesEqual(ownValue, cropValue) ? null : 'ownValue';
}
