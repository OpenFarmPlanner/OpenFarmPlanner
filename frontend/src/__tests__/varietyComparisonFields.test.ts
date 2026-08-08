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

  it('diffs boolean fields, including false vs. true', () => {
    const nantes: Culture = { id: 1, name: 'Carrot', variety: 'Nantes', allow_deviation_delivery_weeks: true };
    const bolero: Culture = { id: 2, name: 'Carrot', variety: 'Bolero', allow_deviation_delivery_weeks: false };

    expect(getVaryingComparisonFields([nantes, bolero], cropCulture).map((field) => field.id)).toContain('allowDeviationDeliveryWeeks');
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
