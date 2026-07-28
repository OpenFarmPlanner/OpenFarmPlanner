/**
 * UI-language resolution rules.
 *
 * Covers the contract in docs/i18n.md: browser tags normalise to a supported
 * language, unsupported ones fall back to English, and an explicit choice
 * always beats the browser.
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
  AUTO_LANGUAGE,
  FALLBACK_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  detectBrowserLanguage,
  getLanguageLabel,
  normalizeLanguagePreference,
  normalizeLanguageTag,
  readStoredLanguagePreference,
  resolveInitialLanguage,
  resolveLanguage,
  writeStoredLanguagePreference,
} from '../i18n/languages';

function navigatorWith(languages: string[]): Pick<Navigator, 'languages' | 'language'> {
  return { languages, language: languages[0] ?? '' } as Pick<Navigator, 'languages' | 'language'>;
}

afterEach(() => {
  window.localStorage.removeItem(LANGUAGE_STORAGE_KEY);
});

describe('normalizeLanguageTag', () => {
  it('maps every German regional tag to de', () => {
    for (const tag of ['de', 'de-AT', 'de-DE', 'de-CH', 'DE-at', 'de_DE']) {
      expect(normalizeLanguageTag(tag)).toBe('de');
    }
  });

  it('maps every English regional tag to en', () => {
    for (const tag of ['en', 'en-US', 'en-GB', 'EN-au', 'en_GB']) {
      expect(normalizeLanguageTag(tag)).toBe('en');
    }
  });

  it('returns null for unsupported and empty tags', () => {
    for (const tag of ['fr', 'fr-FR', 'zh-Hans', 'xx', '', '   ', null, undefined]) {
      expect(normalizeLanguageTag(tag)).toBeNull();
    }
  });
});

describe('detectBrowserLanguage', () => {
  it('detects de-AT as German', () => {
    expect(detectBrowserLanguage(navigatorWith(['de-AT']))).toBe('de');
  });

  it('detects en-GB as English', () => {
    expect(detectBrowserLanguage(navigatorWith(['en-GB']))).toBe('en');
  });

  it('falls back to English for unsupported browser languages', () => {
    expect(detectBrowserLanguage(navigatorWith(['fr-FR', 'it-IT']))).toBe(FALLBACK_LANGUAGE);
    expect(detectBrowserLanguage(navigatorWith([]))).toBe(FALLBACK_LANGUAGE);
  });

  it('picks the first supported entry rather than the first entry', () => {
    expect(detectBrowserLanguage(navigatorWith(['fr-FR', 'de-CH', 'en-US']))).toBe('de');
  });
});

describe('resolveLanguage', () => {
  it('lets a stored choice override the browser language', () => {
    expect(resolveLanguage('de', 'en')).toBe('de');
    expect(resolveLanguage('en', 'de')).toBe('en');
  });

  it('follows the browser language for the auto preference', () => {
    expect(resolveLanguage(AUTO_LANGUAGE, 'de')).toBe('de');
    expect(resolveLanguage(null, 'en')).toBe('en');
  });
});

describe('stored preference', () => {
  it('round-trips an explicit choice', () => {
    writeStoredLanguagePreference('de');
    expect(readStoredLanguagePreference()).toBe('de');
  });

  it('round-trips the auto preference', () => {
    writeStoredLanguagePreference(AUTO_LANGUAGE);
    expect(readStoredLanguagePreference()).toBe(AUTO_LANGUAGE);
  });

  it('reports no preference when nothing was ever chosen', () => {
    expect(readStoredLanguagePreference()).toBeNull();
  });

  it('ignores an unsupported stored value instead of trusting it', () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr');
    expect(readStoredLanguagePreference()).toBeNull();
  });

  it('survives a reload: the stored choice still wins over the browser language', () => {
    // The suite reports de-DE as the browser language (see setupTests).
    writeStoredLanguagePreference('en');
    expect(resolveInitialLanguage()).toBe('en');
  });

  it('uses the browser language when no choice was made', () => {
    expect(resolveInitialLanguage()).toBe('de');
  });
});

describe('normalizeLanguagePreference', () => {
  it('accepts the supported values', () => {
    expect(normalizeLanguagePreference('de')).toBe('de');
    expect(normalizeLanguagePreference('en')).toBe('en');
    expect(normalizeLanguagePreference(AUTO_LANGUAGE)).toBe(AUTO_LANGUAGE);
  });

  it('treats anything else as auto rather than throwing', () => {
    expect(normalizeLanguagePreference('fr')).toBe(AUTO_LANGUAGE);
    expect(normalizeLanguagePreference(undefined)).toBe(AUTO_LANGUAGE);
  });
});

describe('getLanguageLabel', () => {
  it('names each language in that language, not in the UI language', () => {
    expect(getLanguageLabel('de')).toBe('Deutsch');
    expect(getLanguageLabel('en')).toBe('English');
  });
});
