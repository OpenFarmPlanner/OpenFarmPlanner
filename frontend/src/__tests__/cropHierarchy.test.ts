import { describe, expect, it } from 'vitest';
import { buildCropHierarchy, findSpeciesCulture, withGroupGeneralCultures } from '../cultures/cropHierarchy';
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

    // Carrot has no dedicated general (variety-less) entry — its species row
    // must not fall back to displaying/selecting Carrot's only variety as if
    // it were also the general entry (that would show culture id 4 twice:
    // once as the species node, once as its own variety row).
    const carrotSpeciesRow = rows.find((row) => row.kind === 'species' && row.label === 'Carrot');
    expect(carrotSpeciesRow?.hasGeneralEntry).toBe(false);
    expect(carrotSpeciesRow?.culture).toBeNull();
    const carrotVarietyRows = rows.filter((row) => row.kind === 'variety' && row.speciesKey === carrotSpeciesRow?.speciesKey);
    expect(carrotVarietyRows).toHaveLength(1);
    expect(carrotVarietyRows[0]?.culture?.id).toBe(4);
  });

  it('finds the general crop record for a variety', () => {
    const general: Culture = { id: 1, name: 'Tomato', crop_species: 10, variety: '', growth_duration_days: 70 };
    const variety: Culture = { id: 2, name: 'Tomato', crop_species: 10, variety: 'Roma QA' };

    expect(findSpeciesCulture(variety, [variety, general])).toBe(general);
  });
});

describe('withGroupGeneralCultures', () => {
  const general: Culture = { id: 1, name: 'Pfefferoni', crop_species: 10, variety: '', growth_duration_days: 60 };
  const variety: Culture = { id: 2, name: 'Pfefferoni', crop_species: 10, variety: 'Milder Spiral' };
  const otherCrop: Culture = { id: 3, name: 'Carrot', crop_species: 20, variety: 'Nantaise' };
  const allCultures = [general, variety, otherCrop];

  it('keeps the Kultur of a group whose variety matched the search', () => {
    // Searching for "spir" only matches the Sorte, but its Kultur has to stay
    // in the list or the tree row for it has no data of its own to show.
    const result = withGroupGeneralCultures([variety], allCultures);

    expect(result).toContain(variety);
    expect(result).toContain(general);
    const rows = buildCropHierarchy(result);
    const speciesRow = rows.find((row) => row.kind === 'species');
    expect(speciesRow?.culture).toBe(general);
    expect(speciesRow?.hasGeneralEntry).toBe(true);
  });

  it('does not pull in Kulturen of groups that had no match at all', () => {
    const result = withGroupGeneralCultures([variety], allCultures);

    expect(result).not.toContain(otherCrop);
  });

  it('leaves a match list that already has its Kultur untouched', () => {
    const result = withGroupGeneralCultures([general, variety], allCultures);

    expect(result).toEqual([general, variety]);
  });

  it('adds nothing when nothing matched, so the empty state still shows', () => {
    expect(withGroupGeneralCultures([], allCultures)).toEqual([]);
  });

  it('groups free-text cultures without a species by name', () => {
    const freeGeneral: Culture = { id: 4, name: 'Tomate', variety: '' };
    const freeVariety: Culture = { id: 5, name: 'Tomate', variety: 'Matina' };

    const result = withGroupGeneralCultures([freeVariety], [freeGeneral, freeVariety]);

    expect(result).toContain(freeGeneral);
  });
});
