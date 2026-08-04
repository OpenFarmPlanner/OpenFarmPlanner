import { describe, it, expect } from 'vitest';
import { areCropValuesEqual, getVarietyOwnValueSource, isEmptyCropValue } from '../cultures/varietyValueSource';
import type { Culture } from '../api/types';

describe('isEmptyCropValue', () => {
  it('treats null, undefined, empty string and empty arrays as empty', () => {
    expect(isEmptyCropValue(null)).toBe(true);
    expect(isEmptyCropValue(undefined)).toBe(true);
    expect(isEmptyCropValue('')).toBe(true);
    expect(isEmptyCropValue([])).toBe(true);
  });

  it('treats 0, false and non-empty values as not empty', () => {
    expect(isEmptyCropValue(0)).toBe(false);
    expect(isEmptyCropValue(false)).toBe(false);
    expect(isEmptyCropValue('a')).toBe(false);
    expect(isEmptyCropValue(['x'])).toBe(false);
  });
});

describe('areCropValuesEqual', () => {
  it('treats different empty representations as equal', () => {
    expect(areCropValuesEqual(null, undefined)).toBe(true);
    expect(areCropValuesEqual('', [])).toBe(true);
  });

  it('compares numbers within floating point epsilon', () => {
    expect(areCropValuesEqual(1.1, 1.1)).toBe(true);
    expect(areCropValuesEqual(1, 2)).toBe(false);
  });

  it('compares arrays and objects structurally', () => {
    expect(areCropValuesEqual(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(areCropValuesEqual(['a', 'b'], ['b', 'a'])).toBe(false);
  });

  it('compares strings and other scalars by identity', () => {
    expect(areCropValuesEqual('low', 'low')).toBe(true);
    expect(areCropValuesEqual('low', 'high')).toBe(false);
  });
});

describe('getVarietyOwnValueSource', () => {
  const speciesCulture: Partial<Culture> = {
    id: 1,
    name: 'Karotte',
    variety: '',
    row_spacing_cm: 30,
    nutrient_demand: 'medium',
  };

  it('returns null when the culture has no variety', () => {
    const culture: Partial<Culture> = { name: 'Karotte', variety: '', row_spacing_cm: 40 };
    expect(getVarietyOwnValueSource(culture, speciesCulture, 'row_spacing_cm')).toBeNull();
  });

  it('returns null when there is no species culture to compare against', () => {
    const culture: Partial<Culture> = { name: 'Karotte', variety: 'Nantaise', row_spacing_cm: 40 };
    expect(getVarietyOwnValueSource(culture, null, 'row_spacing_cm')).toBeNull();
  });

  it('returns null when the variety value is empty (falls back to the crop value)', () => {
    const culture: Partial<Culture> = { name: 'Karotte', variety: 'Nantaise', row_spacing_cm: undefined };
    expect(getVarietyOwnValueSource(culture, speciesCulture, 'row_spacing_cm')).toBeNull();
  });

  it('returns null when the variety value matches the crop value', () => {
    const culture: Partial<Culture> = { name: 'Karotte', variety: 'Nantaise', row_spacing_cm: 30 };
    expect(getVarietyOwnValueSource(culture, speciesCulture, 'row_spacing_cm')).toBeNull();
  });

  it('returns "ownValue" when the variety overrides the crop value', () => {
    const culture: Partial<Culture> = { name: 'Karotte', variety: 'Nantaise', row_spacing_cm: 40 };
    expect(getVarietyOwnValueSource(culture, speciesCulture, 'row_spacing_cm')).toBe('ownValue');
  });
});
