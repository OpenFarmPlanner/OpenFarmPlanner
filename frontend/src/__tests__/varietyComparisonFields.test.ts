import { describe, it, expect } from 'vitest';
import { getVarietyDifferences } from '../cultures/varietyComparisonFields';
import type { Culture } from '../api/types';

const t = (key: string): string => key;

describe('getVarietyDifferences', () => {
  const cropCulture: Culture = {
    id: 1,
    name: 'Carrot',
    variety: '',
    crop_family: 'Apiaceae',
    row_spacing_cm: 30,
    growth_duration_days: 100,
  };

  it('returns no rows when the variety matches the crop on every field', () => {
    const variety: Culture = { id: 2, name: 'Carrot', variety: 'Nantes' };
    expect(getVarietyDifferences(variety, cropCulture, t, 'de-DE')).toEqual([]);
  });

  it('returns a row only for fields the variety explicitly overrides', () => {
    const variety: Culture = { id: 2, name: 'Carrot', variety: 'Nantes', row_spacing_cm: 40 };
    const differences = getVarietyDifferences(variety, cropCulture, t, 'de-DE');

    expect(differences).toHaveLength(1);
    expect(differences[0]).toMatchObject({ id: 'rowSpacing' });
  });

  it('flags a field as different when the variety sets a value the crop leaves empty', () => {
    const variety: Culture = { id: 2, name: 'Carrot', variety: 'Nantes', expected_yield: 5 };
    const differences = getVarietyDifferences(variety, cropCulture, t, 'de-DE');

    expect(differences.map((diff) => diff.id)).toContain('expectedYield');
  });

  it('does not flag a field as different when the variety leaves it empty and inherits the crop value', () => {
    const variety: Culture = { id: 2, name: 'Carrot', variety: 'Nantes' };
    const differences = getVarietyDifferences(variety, cropCulture, t, 'de-DE');

    expect(differences.map((diff) => diff.id)).not.toContain('rowSpacing');
    expect(differences.map((diff) => diff.id)).not.toContain('growthDurationDays');
  });

  it('diffs array-valued fields (cultivation types) structurally', () => {
    const cropWithTypes: Culture = { ...cropCulture, cultivation_types: ['pre_cultivation'] };
    const variety: Culture = { id: 2, name: 'Carrot', variety: 'Nantes', cultivation_types: ['direct_sowing'] };
    const differences = getVarietyDifferences(variety, cropWithTypes, t, 'de-DE');

    expect(differences.map((diff) => diff.id)).toContain('cultivationType');
  });

  it('diffs boolean fields, including a false variety value overriding a true crop value', () => {
    const cropWithDeviation: Culture = { ...cropCulture, allow_deviation_delivery_weeks: true };
    const variety: Culture = { id: 2, name: 'Carrot', variety: 'Nantes', allow_deviation_delivery_weeks: false };
    const differences = getVarietyDifferences(variety, cropWithDeviation, t, 'de-DE');

    expect(differences.map((diff) => diff.id)).toContain('allowDeviationDeliveryWeeks');
  });
});
