/**
 * Guards that every supported locale defines exactly the same keys.
 *
 * A key present in one bundle but not the other is a silent bug: i18next
 * falls back to English, so a German user sees an English string with no
 * warning. This test makes that a build failure instead.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { SUPPORTED_LANGUAGES } from '../i18n/languages';

const LOCALES_DIR = path.resolve(__dirname, '../i18n/locales');
const REFERENCE_LANGUAGE = 'de';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** Flatten a bundle to `dotted.key -> value`, indexing arrays by position. */
function flatten(value: JsonValue, prefix = ''): Map<string, JsonValue> {
  const flat = new Map<string, JsonValue>();
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      const key = `${prefix}.${index}`;
      if (entry !== null && typeof entry === 'object') {
        for (const [nested, nestedValue] of flatten(entry, key)) {
          flat.set(nested, nestedValue);
        }
      } else {
        flat.set(key, entry);
      }
    });
    return flat;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      if (entry !== null && typeof entry === 'object') {
        for (const [nested, nestedValue] of flatten(entry as JsonValue, nextPrefix)) {
          flat.set(nested, nestedValue);
        }
      } else {
        flat.set(nextPrefix, entry as JsonValue);
      }
    }
    return flat;
  }
  flat.set(prefix, value);
  return flat;
}

function readBundle(language: string, file: string): Map<string, JsonValue> {
  const raw = fs.readFileSync(path.join(LOCALES_DIR, language, file), 'utf8');
  return flatten(JSON.parse(raw) as JsonValue);
}

const namespaceFiles = fs
  .readdirSync(path.join(LOCALES_DIR, REFERENCE_LANGUAGE))
  .filter((file) => file.endsWith('.json'))
  .sort();

const otherLanguages = SUPPORTED_LANGUAGES
  .map((entry) => entry.code)
  .filter((code) => code !== REFERENCE_LANGUAGE);

describe('translation bundle parity', () => {
  it('ships the same namespace files for every language', () => {
    for (const language of otherLanguages) {
      const files = fs
        .readdirSync(path.join(LOCALES_DIR, language))
        .filter((file) => file.endsWith('.json'))
        .sort();
      expect(files, `namespace files for "${language}"`).toEqual(namespaceFiles);
    }
  });

  it.each(namespaceFiles)('%s defines the same keys in every language', (file) => {
    const reference = readBundle(REFERENCE_LANGUAGE, file);

    for (const language of otherLanguages) {
      const bundle = readBundle(language, file);
      const missing = [...reference.keys()].filter((key) => !bundle.has(key)).sort();
      const extra = [...bundle.keys()].filter((key) => !reference.has(key)).sort();

      expect(missing, `keys missing from ${language}/${file}`).toEqual([]);
      expect(extra, `keys in ${language}/${file} but not in ${REFERENCE_LANGUAGE}/${file}`).toEqual([]);
    }
  });

  it.each(namespaceFiles)('%s has no blank translations', (file) => {
    for (const language of SUPPORTED_LANGUAGES.map((entry) => entry.code)) {
      const blank = [...readBundle(language, file)]
        .filter(([, value]) => typeof value === 'string' && value.trim() === '')
        .map(([key]) => key)
        .sort();
      expect(blank, `blank values in ${language}/${file}`).toEqual([]);
    }
  });

  it.each(namespaceFiles)('%s keeps interpolation placeholders identical across languages', (file) => {
    const reference = readBundle(REFERENCE_LANGUAGE, file);
    const placeholders = (value: JsonValue): string[] =>
      typeof value === 'string' ? [...value.matchAll(/\{\{(\w+)/g)].map((m) => m[1]).sort() : [];

    for (const language of otherLanguages) {
      const bundle = readBundle(language, file);
      for (const [key, value] of reference) {
        // A placeholder dropped in translation renders an empty gap; an added
        // one renders literal "{{name}}". Both are visible bugs.
        expect(placeholders(bundle.get(key) ?? null), `placeholders for ${language}/${file}:${key}`)
          .toEqual(placeholders(value));
      }
    }
  });
});
