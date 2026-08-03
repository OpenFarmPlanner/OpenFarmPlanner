import { describe, expect, it } from 'vitest';
import { buildCropHierarchy, findSpeciesCulture } from '../cultures/cropHierarchy';
import type { Culture } from '../api/types';

describe('buildCropHierarchy', () => {
  it('groups general crop entries and varieties under the same species', () => {
    const cultures: Culture[] = [
      { id: 1, name: 'Tomato', crop_species: 10, variety: '', growth_duration_days: 70 },
      { id: 2, name: 'Tomato', crop_species: 10, variety: 'Roma QA' },
      { id: 3, name: 'Tomato', crop_species: 10, variety: 'Moneymaker' },
      { id: 4, name: 'Carrot', crop_species: 20, variety: 'Nantaise' },
    ];

    const rows = buildCropHierarchy(cultures);

    expect(rows.map((row) => [row.kind, row.label, row.parentId])).toEqual([
      ['species', 'Tomato', null],
      ['variety', 'Roma QA', 'species:species:10'],
      ['variety', 'Moneymaker', 'species:species:10'],
      ['species', 'Carrot', null],
      ['variety', 'Nantaise', 'species:species:20'],
    ]);
    expect(rows.find((row) => row.label === 'Tomato')?.culture?.id).toBe(1);
  });

  it('finds the general crop record for a variety', () => {
    const general: Culture = { id: 1, name: 'Tomato', crop_species: 10, variety: '', growth_duration_days: 70 };
    const variety: Culture = { id: 2, name: 'Tomato', crop_species: 10, variety: 'Roma QA' };

    expect(findSpeciesCulture(variety, [variety, general])).toBe(general);
  });
});
