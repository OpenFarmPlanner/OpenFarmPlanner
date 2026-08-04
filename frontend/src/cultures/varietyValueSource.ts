import type { Culture } from '../api/types';

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
