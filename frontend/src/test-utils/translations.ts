/**
 * Synchronous access to the real German translation bundles for use in tests,
 * without needing to await i18next initialization.
 *
 * These are the same namespace files i18n/config.ts loads at runtime, so
 * `translations.navigation.cultures` always reflects the copy users actually see.
 */

import cultures from '../i18n/locales/de/cultures.json';
import navigation from '../i18n/locales/de/navigation.json';

const translations = {
  navigation,
  cultures,
};

export default translations;
