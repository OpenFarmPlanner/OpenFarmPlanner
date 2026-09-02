import { describe, expect, it } from 'vitest';
import {
  dedupePublicCropsBySpecies,
  dedupePublicCropVarieties,
  isLikelyTestPublicCropEntry,
} from '../crops/publicCropNameSuggestions';
import type { PublicCrop } from '../api/types';

const crop = (overrides: Partial<PublicCrop>): PublicCrop => ({
  id: 1,
  status: 'published',
  name: 'Tomate',
  variety: '',
  version: 1,
  ...overrides,
});

describe('isLikelyTestPublicCropEntry', () => {
  it('flags entries whose name or variety looks like QA/test data', () => {
    expect(isLikelyTestPublicCropEntry(crop({ variety: 'QA DE zweisprachig 1785241' }))).toBe(true);
    expect(isLikelyTestPublicCropEntry(crop({ name: 'Test Tomato' }))).toBe(true);
    expect(isLikelyTestPublicCropEntry(crop({ variety: 'Roma' }))).toBe(false);
  });
});

describe('dedupePublicCropsBySpecies', () => {
  it('collapses multiple varieties of the same species into one name option', () => {
    const options = dedupePublicCropsBySpecies([
      crop({ id: 1, crop_species: 7, display_name: 'Tomate', variety: 'Roma' }),
      crop({ id: 2, crop_species: 7, display_name: 'Tomate', variety: 'Moneymaker' }),
      crop({ id: 3, crop_species: 8, display_name: 'Karotte', variety: 'Nantaise' }),
    ]);

    expect(options).toEqual([
      { key: 7, cropSpeciesId: 7, canonicalName: 'Tomate', name: 'Tomate', matchedAlias: null, searchNames: ['Tomate'] },
      { key: 8, cropSpeciesId: 8, canonicalName: 'Karotte', name: 'Karotte', matchedAlias: null, searchNames: ['Karotte'] },
    ]);
  });

  it('filters out likely QA/test entries', () => {
    const options = dedupePublicCropsBySpecies([
      crop({ id: 1, crop_species: 7, display_name: 'Tomate', variety: 'QA DE zweisprachig 123' }),
    ]);

    expect(options).toEqual([]);
  });

  it('falls back to normalized name grouping for legacy entries without a species link', () => {
    const options = dedupePublicCropsBySpecies([
      crop({ id: 1, crop_species: null, name: ' Kohlrabi ', variety: 'Blauer' }),
      crop({ id: 2, crop_species: null, name: 'kohlrabi', variety: 'Weißer' }),
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
    const options = dedupePublicCropsBySpecies([
      crop({
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

describe('dedupePublicCropVarieties', () => {
  it('returns unique, non-empty variety names and filters test entries', () => {
    const varieties = dedupePublicCropVarieties([
      crop({ id: 1, variety: 'Roma' }),
      crop({ id: 2, variety: 'Roma' }),
      crop({ id: 3, variety: '' }),
      crop({ id: 4, variety: 'QA DE zweisprachig 123' }),
      crop({ id: 5, variety: 'Moneymaker' }),
    ]);

    expect(varieties.sort()).toEqual(['Moneymaker', 'Roma']);
  });
});
