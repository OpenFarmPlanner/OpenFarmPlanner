import type { TFunction } from 'i18next';

/**
 * Command-palette search aliases for one command, in the active UI language.
 *
 * Stored as a comma-separated string per language so a translator can add or
 * drop aliases without the two locale bundles disagreeing about array length
 * (the key-parity check compares array indices).
 *
 * The English aliases are always appended, in both languages: shortcut names
 * and command vocabulary ("delete", "export", "plan") are what many users type
 * regardless of the interface language, and dropping them would make the
 * palette worse without making it more German.
 */
export function keywordList(t: TFunction, key: string): string[] {
  const localized = splitKeywords(t(key) as string, key);
  const english = splitKeywords(t(key, { lng: 'en' }) as string, key);
  return [...new Set([...localized, ...english])];
}

function splitKeywords(value: string, key: string): string[] {
  // A missing key resolves to the key itself; treat that as "no aliases"
  // rather than putting a dotted key path into the search index.
  if (!value || value === key) {
    return [];
  }
  return value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}
