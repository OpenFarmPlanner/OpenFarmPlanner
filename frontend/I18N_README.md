# Frontend i18n — quick reference

The full specification lives in **[`docs/i18n.md`](../docs/i18n.md)**:
supported languages, the UI-language resolution order, storage for guests and
signed-in users, the crop-library translation model and its fallback rules,
cross-language search and duplicate detection, and the migration assumptions.

This file only covers the day-to-day frontend mechanics.

## Using translations

```tsx
import { useTranslation } from '../i18n';

function MyComponent() {
  const { t } = useTranslation('crops');
  return <h1>{t('title')}</h1>;
}
```

Cross-namespace keys use the `namespace:key` form:

```tsx
t('common:actions.save')
```

## Rules

- **Never hardcode visible text.** Every user-visible string goes through `t()`.
- **Never use a German `defaultValue`.** `t('key', { defaultValue: 'Speichern' })`
  leaks German into an English UI. Add the key to both bundles instead.
- **Add every key to both bundles.** `src/i18n/locales/de/` *and*
  `src/i18n/locales/en/`. `src/__tests__/i18nKeyParity.test.ts` fails the build
  on missing keys, extra keys, blank values, and mismatched `{{placeholders}}`.
- **Name keys by function**, grouped by area (`form.nameRequired`,
  `library.publishConfirm.title`) — never auto-numbered.
- **Do not translate user content.** Project, location, field, bed and supplier
  names, variety names and private notes are shown exactly as entered.

## Reading and changing the language

```ts
import { useLanguagePreference } from '../i18n/useLanguagePreference';

const { language, preference, setPreference } = useLanguagePreference();
setPreference('en');   // or 'de', or 'auto' to follow the browser
```

`setPreference` applies the change immediately, stores it locally, and — for a
signed-in user — persists it to their account. The switchers themselves are in
`src/i18n/LanguageSwitcher.tsx`.

## Files

| Path | Purpose |
| --- | --- |
| `src/i18n/config.ts` | i18next setup and bundle registration |
| `src/i18n/languages.ts` | supported languages, tag normalization, storage |
| `src/i18n/useLanguagePreference.ts` | the single place the language is resolved |
| `src/i18n/LanguageSwitcher.tsx` | public, account and menu switchers |
| `src/i18n/LanguageSynchronizer.tsx` | applies the language app-wide, mounted at the root |
| `src/i18n/locales/<lang>/*.json` | the translation bundles |

## Adding a language

See [`docs/i18n.md`](../docs/i18n.md) § "Adding a language".
