/**
 * Display helpers for public crop-library entries.
 *
 * The API already resolves the caller's language and reports which language it
 * actually served (`display_language_code` / `description_language_code`). These
 * helpers turn that into what the UI needs: a name that is never empty, and a
 * flag for whether the text is a real translation or a fallback from another
 * language, so the UI can say so instead of passing an English name off as a
 * German one.
 *
 * Variety names are proper names and are never translated — they are appended
 * verbatim in every language.
 */

import type { TFunction } from 'i18next';

import type { PublicCulture } from '../api/types';
import { normalizeLanguageTag, type SupportedLanguage } from '../i18n/languages';

export interface LocalizedText {
  /** The text to render. Never empty, never `undefined`/`null`/a raw id. */
  text: string;
  /** The language the text came from, or `null` when nothing was available. */
  languageCode: SupportedLanguage | null;
  /** True when the text is a fallback from a language other than the UI one. */
  isFallback: boolean;
}

function buildLocalizedText(
  value: string | undefined,
  servedLanguage: string | undefined,
  currentLanguage: string,
  fallbackText: string,
): LocalizedText {
  const text = (value ?? '').trim();
  const served = normalizeLanguageTag(servedLanguage);
  if (!text) {
    return { text: fallbackText, languageCode: null, isFallback: false };
  }
  return {
    text,
    languageCode: served,
    // `served === null` means the backend had no translation at all and fell
    // back to a canonical/legacy value; that is a fallback too.
    isFallback: served !== normalizeLanguageTag(currentLanguage),
  };
}

/**
 * Species name of a public entry in the current UI language.
 *
 * @param fallbackText Shown when the entry has no usable name at all, so the
 *   UI renders a readable placeholder rather than an empty cell.
 */
export function getPublicCultureName(
  culture: PublicCulture,
  currentLanguage: string,
  fallbackText: string,
): LocalizedText {
  return buildLocalizedText(
    culture.display_name || culture.crop_species_name || culture.name,
    culture.display_language_code,
    currentLanguage,
    fallbackText,
  );
}

/** Public description of an entry in the current UI language. */
export function getPublicCultureDescription(
  culture: PublicCulture,
  currentLanguage: string,
): LocalizedText {
  return buildLocalizedText(
    culture.description || culture.notes,
    culture.description_language_code,
    currentLanguage,
    '',
  );
}

/**
 * Full title: localized species name plus the untranslated variety name.
 *
 * Renders as "Tomate (Moneymaker)" in German and "Tomato (Moneymaker)" in
 * English — same variety, same crop, one record.
 */
export function getPublicCultureTitle(
  culture: PublicCulture,
  currentLanguage: string,
  fallbackText: string,
): string {
  const { text } = getPublicCultureName(culture, currentLanguage, fallbackText);
  return culture.variety ? `${text} (${culture.variety})` : text;
}

/**
 * Tooltip text for the "only available in another language" hint, or `null`
 * when the content really is in the current language.
 */
export function getFallbackNotice(
  localized: LocalizedText,
  t: TFunction,
): { label: string; tooltip: string } | null {
  if (!localized.isFallback || !localized.languageCode) {
    return null;
  }
  const languageName = t(`library.translation.languageNames.${localized.languageCode}`);
  return {
    label: t('library.translation.fallbackNotice', { language: languageName }),
    tooltip: t('library.translation.fallbackNoticeTooltip', { language: languageName }),
  };
}
