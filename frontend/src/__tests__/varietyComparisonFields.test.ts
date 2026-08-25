import { describe, it, expect } from 'vitest';
import { getComparisonCellValue, getVaryingComparisonFields } from '../cultures/varietyComparisonFields';
import type { Culture } from '../api/types';

const t = (key: string): string => key;
const cropCulture: Culture = { id: 99, name: 'Carrot', variety: '' };

describe('getVaryingComparisonFields', () => {
  it('returns no columns for fewer than two varieties', () => {
    const single: Culture = { id: 1, name: 'Carrot', variety: 'Nantes', row_spacing_cm: 30 };
    expect(getVaryingComparisonFields([single], cropCulture)).toEqual([]);
    expect(getVaryingComparisonFields([], cropCulture)).toEqual([]);
  });

  it('excludes a field when every variety agrees, including when all are empty', () => {
    const nantes: Culture = { id: 1, name: 'Carrot', variety: 'Nantes', row_spacing_cm: 30 };
    const bolero: Culture = { id: 2, name: 'Carrot', variety: 'Bolero', row_spacing_cm: 30 };
    const rodelika: Culture = { id: 3, name: 'Carrot', variety: 'Rodelika' };

    const fieldIds = getVaryingComparisonFields([nantes, bolero], cropCulture).map((field) => field.id);
    expect(fieldIds).not.toContain('rowSpacing');
    expect(getVaryingComparisonFields([nantes, rodelika], cropCulture).map((field) => field.id)).not.toContain('growthDurationDays');
  });

  it('excludes a field when varieties disagree on their own value but resolve to the same inherited crop value', () => {
    const cropWithSpacing: Culture = { ...cropCulture, row_spacing_cm: 30 };
    // Costata has an explicit own value equal to the crop's; the other
    // variety has no own value and therefore inherits the same crop value —
    // effectively identical, so the column should not appear.
    const costata: Culture = { id: 1, name: 'Zucchini', variety: 'Costata Romanesco', row_spacing_cm: 30 };
    const test: Culture = { id: 2, name: 'Zucchini', variety: 'test' };

    const fieldIds = getVaryingComparisonFields([costata, test], cropWithSpacing).map((field) => field.id);
    expect(fieldIds).not.toContain('rowSpacing');
  });

  it('includes a field when at least two varieties disagree, even if others are empty', () => {
    const nantes: Culture = { id: 1, name: 'Carrot', variety: 'Nantes', row_spacing_cm: 30 };
    const bolero: Culture = { id: 2, name: 'Carrot', variety: 'Bolero', row_spacing_cm: 40 };
    const rodelika: Culture = { id: 3, name: 'Carrot', variety: 'Rodelika' };

    const fieldIds = getVaryingComparisonFields([nantes, bolero, rodelika], cropCulture).map((field) => field.id);
    expect(fieldIds).toContain('rowSpacing');
  });

  it('includes a field when one variety has an explicit value equal to the crop, but the other overrides it', () => {
    const cropWithSpacing: Culture = { ...cropCulture, row_spacing_cm: 30 };
    const costata: Culture = { id: 1, name: 'Zucchini', variety: 'Costata Romanesco', row_spacing_cm: 30 };
    const test: Culture = { id: 2, name: 'Zucchini', variety: 'test', row_spacing_cm: 40 };

    const fieldIds = getVaryingComparisonFields([costata, test], cropWithSpacing).map((field) => field.id);
    expect(fieldIds).toContain('rowSpacing');
  });

  it('diffs array-valued fields (cultivation types) structurally', () => {
    const nantes: Culture = { id: 1, name: 'Carrot', variety: 'Nantes', cultivation_types: ['pre_cultivation'] };
    const bolero: Culture = { id: 2, name: 'Carrot', variety: 'Bolero', cultivation_types: ['direct_sowing'] };

    expect(getVaryingComparisonFields([nantes, bolero], cropCulture).map((field) => field.id)).toContain('cultivationType');
  });

});

describe('seedSafetyMargin (cultivation-type-dependent field)', () => {
  // Regression: Costata Romanesco has its own pre-cultivation-specific
  // safety value equal to the crop's; "test" has no own safety value at all
  // and inherits the crop's pre-cultivation value too — both are effectively
  // 20%, so the column must not appear, and neither cell may fall back to
  // the (irrelevant, still-empty/zero) general safety field.
  const cropWithPreCultivationSafety: Culture = {
    ...cropCulture,
    cultivation_types: ['pre_cultivation'],
    sowing_calculation_safety_percent_pre_cultivation: 20,
  };
  const costata: Culture = {
    id: 1,
    name: 'Zucchini',
    variety: 'Costata Romanesco',
    cultivation_types: ['pre_cultivation'],
    sowing_calculation_safety_percent_pre_cultivation: 20,
  };
  const testVariety: Culture = { id: 2, name: 'Zucchini', variety: 'test' };

  it('does not show a column when both varieties resolve to the same cultivation-type-specific value', () => {
    const fieldIds = getVaryingComparisonFields([costata, testVariety], cropWithPreCultivationSafety).map((field) => field.id);
    expect(fieldIds).not.toContain('seedSafetyMargin');
  });

  it('renders the cultivation-type-specific value for a variety with its own override', () => {
    const varyingCrop: Culture = { ...cropWithPreCultivationSafety, sowing_calculation_safety_percent_pre_cultivation: 15 };
    const [field] = getVaryingComparisonFields([costata, testVariety], varyingCrop);
    expect(getComparisonCellValue(costata, varyingCrop, field, t, 'de-DE')).toBe('20 detail.units.percent');
  });

  it('falls back to the crop\'s cultivation-type-specific value, not the unrelated general field, for a variety with no own value', () => {
    const varyingCrop: Culture = { ...cropWithPreCultivationSafety, sowing_calculation_safety_percent_pre_cultivation: 15 };
    const [field] = getVaryingComparisonFields([costata, testVariety], varyingCrop);
    expect(getComparisonCellValue(testVariety, varyingCrop, field, t, 'de-DE')).toBe('15 detail.units.percent');
  });

  it('uses the direct-sowing-specific value when that is the effective cultivation type', () => {
    const directCrop: Culture = {
      ...cropCulture,
      cultivation_types: ['direct_sowing'],
      sowing_calculation_safety_percent_direct: 12,
    };
    const direct: Culture = { id: 3, name: 'Karotte', variety: 'Nantaise', cultivation_types: ['direct_sowing'], sowing_calculation_safety_percent_direct: 8 };
    const inheriting: Culture = { id: 4, name: 'Karotte', variety: 'Rodelika' };

    const [field] = getVaryingComparisonFields([direct, inheriting], directCrop);
    expect(getComparisonCellValue(direct, directCrop, field, t, 'de-DE')).toBe('8 detail.units.percent');
    expect(getComparisonCellValue(inheriting, directCrop, field, t, 'de-DE')).toBe('12 detail.units.percent');
  });
});

describe('getComparisonCellValue', () => {
  const [rowSpacingField] = getVaryingComparisonFields([
    { id: 1, name: 'Carrot', variety: 'Nantes', row_spacing_cm: 30 },
    { id: 2, name: 'Carrot', variety: 'Bolero', row_spacing_cm: 40 },
  ], cropCulture);

  it('renders an em-dash when the field is empty for that variety and the crop has no value either', () => {
    const variety: Culture = { id: 3, name: 'Carrot', variety: 'Rodelika' };
    expect(getComparisonCellValue(variety, cropCulture, rowSpacingField, t, 'de-DE')).toBe('—');
  });

  it('renders the formatted value when the field is set on the variety itself', () => {
    const variety: Culture = { id: 1, name: 'Carrot', variety: 'Nantes', row_spacing_cm: 30 };
    expect(getComparisonCellValue(variety, cropCulture, rowSpacingField, t, 'de-DE')).toBe('30 detail.units.centimeters');
  });

  it('falls back to the inherited crop value when the variety has no own value', () => {
    const variety: Culture = { id: 3, name: 'Carrot', variety: 'Rodelika' };
    const cropWithSpacing: Culture = { ...cropCulture, row_spacing_cm: 25 };
    expect(getComparisonCellValue(variety, cropWithSpacing, rowSpacingField, t, 'de-DE')).toBe('25 detail.units.centimeters');
  });
});
