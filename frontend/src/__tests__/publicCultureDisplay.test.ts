/**
 * Display rules for public crop-library content.
 *
 * Two things must hold, and the rest of the library UI depends on them:
 *  - a missing translation falls back predictably and is *labelled* as a
 *    fallback, so an English name never poses as a German one;
 *  - variety names and other user-entered text are shown exactly as stored.
 */

import { describe, expect, it } from 'vitest';

import type { PublicCulture } from '../api/types';
import i18n from '../i18n/config';
import {
  getDescriptionFallbackNotice,
  getFallbackNotice,
  getPublicCultureDescription,
  getPublicCultureName,
  getPublicCultureTitle,
} from '../crops/publicCultureDisplay';

const t = i18n.getFixedT('de', 'cultures');
const MISSING_NAME = t('library.translation.missingName');

function buildCulture(overrides: Partial<PublicCulture> = {}): PublicCulture {
  return {
    id: 1,
    status: 'published',
    name: 'Tomate',
    variety: 'Moneymaker',
    version: 1,
    ...overrides,
  } as PublicCulture;
}

describe('getPublicCultureName', () => {
  it('uses the translation the API resolved for the current language', () => {
    const result = getPublicCultureName(
      buildCulture({ display_name: 'Tomate', display_language_code: 'de' }),
      'de',
      MISSING_NAME,
    );

    expect(result.text).toBe('Tomate');
    expect(result.isFallback).toBe(false);
  });

  it('flags a name served from another language as a fallback', () => {
    const result = getPublicCultureName(
      buildCulture({ display_name: 'Tomato', display_language_code: 'en' }),
      'de',
      MISSING_NAME,
    );

    expect(result.text).toBe('Tomato');
    expect(result.languageCode).toBe('en');
    expect(result.isFallback).toBe(true);
  });

  it('falls back to the legacy name when no translation exists at all', () => {
    const result = getPublicCultureName(
      buildCulture({ display_name: '', crop_species_name: '', name: 'Altbestand' }),
      'de',
      MISSING_NAME,
    );

    expect(result.text).toBe('Altbestand');
  });

  it('never renders an empty name, undefined, null or a raw id', () => {
    const result = getPublicCultureName(
      buildCulture({ display_name: '', crop_species_name: '', name: '' }),
      'de',
      MISSING_NAME,
    );

    expect(result.text).toBe(MISSING_NAME);
    expect(result.text.trim()).not.toBe('');
    expect(result.text).not.toMatch(/undefined|null|^\d+$/);
  });
});

describe('getPublicCultureTitle', () => {
  it('translates the species but leaves the variety name untouched', () => {
    const culture = buildCulture({ display_name: 'Tomate', display_language_code: 'de' });
    expect(getPublicCultureTitle(culture, 'de', MISSING_NAME)).toBe('Tomate (Moneymaker)');

    const english = buildCulture({ display_name: 'Tomato', display_language_code: 'en' });
    expect(getPublicCultureTitle(english, 'en', MISSING_NAME)).toBe('Tomato (Moneymaker)');
  });

  it('omits the parentheses when there is no variety', () => {
    const culture = buildCulture({ display_name: 'Tomate', display_language_code: 'de', variety: '' });
    expect(getPublicCultureTitle(culture, 'de', MISSING_NAME)).toBe('Tomate');
  });

  it('leaves a variety name with unusual casing and spacing exactly as stored', () => {
    const culture = buildCulture({
      display_name: 'Tomate',
      display_language_code: 'de',
      variety: '  Ox Heart  IX ',
    });

    expect(getPublicCultureTitle(culture, 'de', MISSING_NAME)).toBe('Tomate (  Ox Heart  IX )');
  });
});

describe('getPublicCultureDescription', () => {
  it('returns the description for the current language without a fallback flag', () => {
    const result = getPublicCultureDescription(
      buildCulture({ description: 'Robuste Sorte.', description_language_code: 'de' }),
      'de',
    );

    expect(result.text).toBe('Robuste Sorte.');
    expect(result.isFallback).toBe(false);
  });

  it('flags an English description shown in a German UI', () => {
    const result = getPublicCultureDescription(
      buildCulture({ description: 'A robust variety.', description_language_code: 'en' }),
      'de',
    );

    expect(result.text).toBe('A robust variety.');
    expect(result.isFallback).toBe(true);
  });

  it('is empty rather than showing a placeholder when there is no description', () => {
    const result = getPublicCultureDescription(buildCulture({ description: '', notes: '' }), 'de');

    expect(result.text).toBe('');
    expect(result.isFallback).toBe(false);
  });
});

describe('getFallbackNotice', () => {
  it('names the language the content actually came from, localized into the current UI language', () => {
    const localized = getPublicCultureName(
      buildCulture({ display_name: 'Tomato', display_language_code: 'en' }),
      'de',
      MISSING_NAME,
    );

    const notice = getFallbackNotice(localized, t, 'de');

    expect(notice).not.toBeNull();
    expect(notice?.label).toContain('Englisch');
    expect(notice?.tooltip).toContain('Englisch');
  });

  it('shows no notice when the content is in the current language', () => {
    const localized = getPublicCultureName(
      buildCulture({ display_name: 'Tomate', display_language_code: 'de' }),
      'de',
      MISSING_NAME,
    );

    expect(getFallbackNotice(localized, t, 'de')).toBeNull();
  });
});

describe('getDescriptionFallbackNotice', () => {
  it('falls back to the original (German) description and labels it, with a call to contribute a translation', () => {
    const localized = getPublicCultureDescription(
      buildCulture({ description: 'A robust variety.', description_language_code: 'en' }),
      'de',
    );

    const notice = getDescriptionFallbackNotice(localized, t, 'de');

    expect(notice).not.toBeNull();
    expect(notice?.label).toContain('Englisch');
    expect(notice?.tooltip).toContain('Englisch');
    expect(notice?.tooltip).toMatch(/Deutsch/);
  });

  it('shows an equivalent, localized message in every supported UI language', () => {
    const localized = getPublicCultureDescription(
      buildCulture({ description: 'Robuste Sorte.', description_language_code: 'de' }),
      'en',
    );

    const tEn = i18n.getFixedT('en', 'cultures');
    const notice = getDescriptionFallbackNotice(localized, tEn, 'en');

    expect(notice).not.toBeNull();
    expect(notice?.label).toBe('Only available in German');
    expect(notice?.tooltip).toContain('German');
    expect(notice?.tooltip).toMatch(/help/i);
  });

  it('shows no notice when the description is already in the current language', () => {
    const localized = getPublicCultureDescription(
      buildCulture({ description: 'Robuste Sorte.', description_language_code: 'de' }),
      'de',
    );

    expect(getDescriptionFallbackNotice(localized, t, 'de')).toBeNull();
  });
});
