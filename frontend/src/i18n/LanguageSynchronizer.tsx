/**
 * Applies the effective UI language for the whole app, exactly once.
 *
 * Mounted at the root (inside `AuthProvider`) rather than left to the language
 * switchers: the account-menu switcher only exists while the menu is open, so
 * without this a signed-in user's stored preference would not take effect
 * until they opened that menu. Mounting it here also keeps the local language
 * cache warm, which is what removes the flash of the wrong language on
 * refresh.
 *
 * Renders nothing.
 */

import { useLanguagePreference } from './useLanguagePreference';

export default function LanguageSynchronizer(): null {
  useLanguagePreference();
  return null;
}
