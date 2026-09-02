import { describe, expect, it, beforeEach } from 'vitest';

import {
  hasCropIdParam,
  readCropIdParam,
  readWithLegacyKey,
  removeWithLegacyKey,
} from '../compat/legacyCropNames';
import {
  LEGACY_SELECTED_CROP_STORAGE_KEY,
  SELECTED_CROP_STORAGE_KEY,
  getStoredCropId,
} from '../pages/cropsPageUtils';

describe('legacy Culture -> Crop compatibility shims', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('storage keys', () => {
    it('adopts a value stored under the pre-rename key', () => {
      localStorage.setItem('selectedCultureId', '42');

      expect(readWithLegacyKey(localStorage, 'selectedCropId', 'selectedCultureId')).toBe('42');
    });

    it('rewrites the adopted value under the new key and drops the old one', () => {
      localStorage.setItem('selectedCultureId', '42');

      readWithLegacyKey(localStorage, 'selectedCropId', 'selectedCultureId');

      expect(localStorage.getItem('selectedCropId')).toBe('42');
      expect(localStorage.getItem('selectedCultureId')).toBeNull();
    });

    it('prefers the new key and clears a stale leftover under the old one', () => {
      localStorage.setItem('selectedCropId', '7');
      localStorage.setItem('selectedCultureId', '42');

      expect(readWithLegacyKey(localStorage, 'selectedCropId', 'selectedCultureId')).toBe('7');
      expect(localStorage.getItem('selectedCultureId')).toBeNull();
    });

    it('returns null when neither key is set', () => {
      expect(readWithLegacyKey(localStorage, 'selectedCropId', 'selectedCultureId')).toBeNull();
    });

    it('clears both spellings so a read-through cannot resurrect the old value', () => {
      localStorage.setItem('selectedCropId', '7');
      localStorage.setItem('selectedCultureId', '42');

      removeWithLegacyKey(localStorage, 'selectedCropId', 'selectedCultureId');

      expect(readWithLegacyKey(localStorage, 'selectedCropId', 'selectedCultureId')).toBeNull();
    });

    it('carries a returning user\'s selected crop through getStoredCropId', () => {
      localStorage.setItem(LEGACY_SELECTED_CROP_STORAGE_KEY, '58');

      expect(getStoredCropId()).toBe(58);
      expect(localStorage.getItem(SELECTED_CROP_STORAGE_KEY)).toBe('58');
    });

    it('works on sessionStorage too (the crop detail filters)', () => {
      sessionStorage.setItem('culturesDetailFiltersV1', '{"searchQuery":"kohl"}');

      const raw = readWithLegacyKey(
        sessionStorage,
        'cropsDetailFiltersV1',
        'culturesDetailFiltersV1',
      );

      expect(raw).toBe('{"searchQuery":"kohl"}');
      expect(sessionStorage.getItem('cropsDetailFiltersV1')).toBe('{"searchQuery":"kohl"}');
    });
  });

  describe('query parameter', () => {
    it('reads the current spelling', () => {
      expect(readCropIdParam(new URLSearchParams('cropId=12'))).toBe('12');
    });

    it('accepts a link that still uses the pre-rename spelling', () => {
      expect(readCropIdParam(new URLSearchParams('cultureId=12'))).toBe('12');
    });

    it('prefers the current spelling when a URL somehow carries both', () => {
      expect(readCropIdParam(new URLSearchParams('cropId=12&cultureId=99'))).toBe('12');
    });

    it('returns null when neither is present', () => {
      expect(readCropIdParam(new URLSearchParams('tab=versions'))).toBeNull();
    });

    it('detects either spelling as explicit state', () => {
      expect(hasCropIdParam(new URLSearchParams('cultureId=12'))).toBe(true);
      expect(hasCropIdParam(new URLSearchParams('cropId=12'))).toBe(true);
      expect(hasCropIdParam(new URLSearchParams('tab=versions'))).toBe(false);
    });
  });
});
