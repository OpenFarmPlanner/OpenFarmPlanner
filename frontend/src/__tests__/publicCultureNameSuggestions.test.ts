import { describe, expect, it } from 'vitest';
import {
  dedupePublicCulturesBySpecies,
  dedupePublicCultureVarieties,
  isLikelyTestPublicCultureEntry,
} from '../cultures/publicCultureNameSuggestions';
import type { PublicCulture } from '../api/types';

const culture = (overrides: Partial<PublicCulture>): PublicCulture => ({
  id: 1,
  status: 'published',
  name: 'Tomate',
  variety: '',
  version: 1,
  ...overrides,
});

describe('isLikelyTestPublicCultureEntry', () => {
  it('flags entries whose name or variety looks like QA/test data', () => {
    expect(isLikelyTestPublicCultureEntry(culture({ variety: 'QA DE zweisprachig 1785241' }))).toBe(true);
    expect(isLikelyTestPublicCultureEntry(culture({ name: 'Test Tomato' }))).toBe(true);
    expect(isLikelyTestPublicCultureEntry(culture({ variety: 'Roma' }))).toBe(false);
  });
});

describe('dedupePublicCulturesBySpecies', () => {
  it('collapses multiple varieties of the same species into one name option', () => {
    const options = dedupePublicCulturesBySpecies([
      culture({ id: 1, crop_species: 7, display_name: 'Tomate', variety: 'Roma' }),
      culture({ id: 2, crop_species: 7, display_name: 'Tomate', variety: 'Moneymaker' }),
      culture({ id: 3, crop_species: 8, display_name: 'Karotte', variety: 'Nantaise' }),
    ]);

    expect(options).toEqual([
      { key: 7, cropSpeciesId: 7, canonicalName: 'Tomate', name: 'Tomate', matchedAlias: null, searchNames: ['Tomate'] },
      { key: 8, cropSpeciesId: 8, canonicalName: 'Karotte', name: 'Karotte', matchedAlias: null, searchNames: ['Karotte'] },
    ]);
  });

  it('filters out likely QA/test entries', () => {
    const options = dedupePublicCulturesBySpecies([
      culture({ id: 1, crop_species: 7, display_name: 'Tomate', variety: 'QA DE zweisprachig 123' }),
    ]);

    expect(options).toEqual([]);
  });

  it('falls back to normalized name grouping for legacy entries without a species link', () => {
    const options = dedupePublicCulturesBySpecies([
      culture({ id: 1, crop_species: null, name: ' Kohlrabi ', variety: 'Blauer' }),
      culture({ id: 2, crop_species: null, name: 'kohlrabi', variety: 'Weißer' }),
    ]);

    expect(options).toEqual([{
      key: 'kohlrabi',
      cropSpeciesId: null,
      canonicalName: ' Kohlrabi ',
      name: ' Kohlrabi ',
      matchedAlias: null,
      searchNames: ['Kohlrabi'],
    }]);
  });

  it('shows the matched alias next to the canonical species name', () => {
    const options = dedupePublicCulturesBySpecies([
      culture({
        id: 1,
        name: 'Aubergine',
        crop_species: 7,
        crop_species_canonical_name: 'Aubergine',
        crop_species_search_names: ['Aubergine', 'Melanzani'],
      }),
    ], 'mela');

    expect(options).toEqual([{
      key: 7,
      cropSpeciesId: 7,
      canonicalName: 'Aubergine',
      name: 'Aubergine (Melanzani)',
      matchedAlias: 'Melanzani',
      searchNames: ['Aubergine', 'Melanzani'],
    }]);
  });
});

describe('dedupePublicCultureVarieties', () => {
  it('returns unique, non-empty variety names and filters test entries', () => {
    const varieties = dedupePublicCultureVarieties([
      culture({ id: 1, variety: 'Roma' }),
      culture({ id: 2, variety: 'Roma' }),
      culture({ id: 3, variety: '' }),
      culture({ id: 4, variety: 'QA DE zweisprachig 123' }),
      culture({ id: 5, variety: 'Moneymaker' }),
    ]);

    expect(varieties.sort()).toEqual(['Moneymaker', 'Roma']);
  });
});
