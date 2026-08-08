import { describe, it, expect } from 'vitest';
import { getComparisonCellValue, getVaryingComparisonFields } from '../cultures/varietyComparisonFields';
import type { Culture } from '../api/types';

const t = (key: string): string => key;

describe('getVaryingComparisonFields', () => {
  it('returns no columns for fewer than two varieties', () => {
    const single: Culture = { id: 1, name: 'Carrot', variety: 'Nantes', row_spacing_cm: 30 };
    expect(getVaryingComparisonFields([single])).toEqual([]);
    expect(getVaryingComparisonFields([])).toEqual([]);
  });

  it('excludes a field when every variety agrees, including when all are empty', () => {
    const nantes: Culture = { id: 1, name: 'Carrot', variety: 'Nantes', row_spacing_cm: 30 };
    const bolero: Culture = { id: 2, name: 'Carrot', variety: 'Bolero', row_spacing_cm: 30 };
    const rodelika: Culture = { id: 3, name: 'Carrot', variety: 'Rodelika' };

    const fieldIds = getVaryingComparisonFields([nantes, bolero]).map((field) => field.id);
    expect(fieldIds).not.toContain('rowSpacing');
    expect(getVaryingComparisonFields([nantes, rodelika]).map((field) => field.id)).not.toContain('growthDurationDays');
  });

  it('includes a field when at least two varieties disagree, even if others are empty', () => {
    const nantes: Culture = { id: 1, name: 'Carrot', variety: 'Nantes', row_spacing_cm: 30 };
    const bolero: Culture = { id: 2, name: 'Carrot', variety: 'Bolero', row_spacing_cm: 40 };
    const rodelika: Culture = { id: 3, name: 'Carrot', variety: 'Rodelika' };

    const fieldIds = getVaryingComparisonFields([nantes, bolero, rodelika]).map((field) => field.id);
    expect(fieldIds).toContain('rowSpacing');
  });

  it('diffs array-valued fields (cultivation types) structurally', () => {
    const nantes: Culture = { id: 1, name: 'Carrot', variety: 'Nantes', cultivation_types: ['pre_cultivation'] };
    const bolero: Culture = { id: 2, name: 'Carrot', variety: 'Bolero', cultivation_types: ['direct_sowing'] };

    expect(getVaryingComparisonFields([nantes, bolero]).map((field) => field.id)).toContain('cultivationType');
  });

  it('diffs boolean fields, including false vs. true', () => {
    const nantes: Culture = { id: 1, name: 'Carrot', variety: 'Nantes', allow_deviation_delivery_weeks: true };
    const bolero: Culture = { id: 2, name: 'Carrot', variety: 'Bolero', allow_deviation_delivery_weeks: false };

    expect(getVaryingComparisonFields([nantes, bolero]).map((field) => field.id)).toContain('allowDeviationDeliveryWeeks');
  });
});

describe('getComparisonCellValue', () => {
  const [rowSpacingField] = getVaryingComparisonFields([
    { id: 1, name: 'Carrot', variety: 'Nantes', row_spacing_cm: 30 },
    { id: 2, name: 'Carrot', variety: 'Bolero', row_spacing_cm: 40 },
  ]);

  it('renders an em-dash when the field is empty for that variety', () => {
    const variety: Culture = { id: 3, name: 'Carrot', variety: 'Rodelika' };
    expect(getComparisonCellValue(variety, rowSpacingField, t, 'de-DE')).toBe('—');
  });

  it('renders the formatted value when the field is set', () => {
    const variety: Culture = { id: 1, name: 'Carrot', variety: 'Nantes', row_spacing_cm: 30 };
    expect(getComparisonCellValue(variety, rowSpacingField, t, 'de-DE')).toBe('30 detail.units.centimeters');
  });
});
