import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import type { Culture, PublicCulture } from '../api/types';
import { buildPublicCultureComparison } from '../pages/publicCultureComparison';

const t = ((key: string, fallback?: string) => fallback ?? key) as TFunction;

const publicCulture: PublicCulture = {
  id: 7,
  status: 'published',
  version: 3,
  name: 'Tomato',
  variety: 'Roma',
  notes: 'Public notes',
  crop_family: 'Solanaceae',
  cultivation_type: 'pre_cultivation',
  cultivation_types: ['pre_cultivation'],
  growth_duration_days: 60,
  harvest_duration_days: 20,
  distance_within_row_m: 0.4,
};

const privateCulture: Culture = {
  name: 'Tomato',
  variety: 'Roma',
  notes: 'Private notes',
  crop_family: 'Solanaceae',
  cultivation_type: 'pre_cultivation',
  cultivation_types: ['pre_cultivation'],
  growth_duration_days: 70,
  harvest_duration_days: 20,
  distance_within_row_cm: 40,
};

describe('buildPublicCultureComparison', () => {
  it('returns only values that would change in the public version', () => {
    const changes = buildPublicCultureComparison(privateCulture, publicCulture, t);

    expect(changes.map((change) => change.field)).toEqual(['notes', 'growth_duration_days']);
    expect(changes[0]).toMatchObject({ publicValue: 'Public notes', privateValue: 'Private notes' });
    expect(changes[1]).toMatchObject({ publicValue: '60', privateValue: '70' });
  });

  it('reports a variety rename, which publishing an update would write to the public entry', () => {
    const changes = buildPublicCultureComparison(
      { ...privateCulture, variety: 'Roma II' },
      publicCulture,
      t,
    );

    expect(changes[0]).toMatchObject({ field: 'variety', publicValue: 'Roma', privateValue: 'Roma II' });
  });

  it('omits the variety for a species-level publish, which always writes an empty variety', () => {
    const changes = buildPublicCultureComparison(
      { ...privateCulture, variety: 'Roma II' },
      publicCulture,
      t,
      { publishAsGeneral: true },
    );

    expect(changes.map((change) => change.field)).not.toContain('variety');
  });

  it('does not report equivalent values after unit conversion', () => {
    const unchanged = buildPublicCultureComparison(
      { ...privateCulture, notes: 'Public notes', growth_duration_days: 60 },
      publicCulture,
      t,
    );

    expect(unchanged).toEqual([]);
  });
});
