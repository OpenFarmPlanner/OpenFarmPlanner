# Internationalization (i18n) Documentation

## Overview

The OpenFarmPlanner frontend uses **i18next** and **react-i18next** for internationalization. The current implementation supports German (de) as the default language, with a structured approach to support additional languages in the future.

## Architecture

### Configuration

The i18n configuration is located in `/frontend/src/i18n/config.ts`. It sets up:

- **Default Language**: German (`de`)
- **Fallback Language**: German (`de`)
- **Debug Mode**: Enabled in development for easier troubleshooting
- **React Integration**: Configured with `useSuspense: false` for easier integration

### Translation Files Structure

Translation files are organized in a namespace-based structure under `/frontend/src/i18n/locales/{language}/`:

```
frontend/src/i18n/
├── config.ts              # i18n configuration
├── index.ts               # Module exports
└── locales/
    └── de/                # German translations
        ├── common.json         # Common UI elements (buttons, messages, fields)
        ├── navigation.json     # Navigation menu items
        ├── home.json           # Home page content
        ├── locations.json      # Locations page
        ├── crops.json       # Crops page
        ├── plantingPlans.json  # Planting Plans page
        
        ├── fields.json         # Fields page
        ├── beds.json           # Beds page
        └── hierarchy.json      # Hierarchy view
```

## Translation Namespaces

### `common` - Common UI Elements

Contains reusable translations across the application:

```json
{
  "appName": "OpenFarmPlanner",
  "actions": {
    "add": "Hinzufügen",
    "edit": "Bearbeiten",
    "delete": "Löschen",
    "save": "Speichern",
    "cancel": "Abbrechen"
  },
  "messages": {
    "loading": "Lädt...",
    "noData": "Keine Daten",
    "error": "Fehler"
  },
  "fields": {
    "name": "Name",
    "address": "Adresse",
    "notes": "Notizen"
  }
}
```

### `navigation` - Navigation Menu

Contains navigation menu labels:

```json
{
  "home": "Start",
  "locations": "Standorte",
  "fieldsAndBeds": "Parzellen & Beete",
  "crops": "Kulturen",
  "plantingPlans": "Anbaupläne",
  
}
```

### Page-specific Namespaces

Each page has its own namespace containing:
- Page title
- Column headers
- Error messages
- Validation messages
- Button labels
- Page-specific content

Example from `locations.json`:

```json
{
  "title": "Standorte",
  "errors": {
    "load": "Fehler beim Laden der Standorte",
    "save": "Fehler beim Speichern des Standorts",
    "delete": "Fehler beim Löschen des Standorts"
  },
  "validation": {
    "nameRequired": "Name ist ein Pflichtfeld"
  },
  "confirmDelete": "Möchten Sie diesen Standort wirklich löschen?",
  "addButton": "Neuen Standort hinzufügen"
}
```

## Usage in Components

### Basic Usage

```typescript
import { useTranslation } from '../i18n';

function MyComponent() {
  const { t } = useTranslation('myNamespace');
  
  return <h1>{t('title')}</h1>;
}
```

### Using Multiple Namespaces

```typescript
import { useTranslation } from '../i18n';

function MyComponent() {
  const { t } = useTranslation(['myNamespace', 'common']);
  
  return (
    <div>
      <h1>{t('myNamespace:title')}</h1>
      <button>{t('common:actions.save')}</button>
    </div>
  );
}
```

### Interpolation

For dynamic values, use interpolation:

```typescript
const { t } = useTranslation('crops');

// In translation file: "lifespanValue": "{{days}} Tage"
const text = t('fields.lifespanValue', { days: 30 });
// Result: "30 Tage"
```

## Translation Key Naming Conventions

1. **Use camelCase** for keys: `daysToFirstHarvest`, not `days_to_first_harvest`
2. **Organize hierarchically**: Group related translations under parent keys
3. **Be descriptive**: Use clear, self-documenting key names
4. **Consistent structure**: Similar pages should have similar key structures

### Standard Key Structure for Pages

```json
{
  "title": "Page Title",
  "columns": {
    "fieldName": "Label"
  },
  "errors": {
    "load": "Error message",
    "save": "Error message",
    "delete": "Error message"
  },
  "validation": {
    "fieldRequired": "Validation message"
  },
  "confirmDelete": "Confirmation message",
  "addButton": "Button label"
}
```

## Adding a New Language

To add support for a new language (e.g., English):

1. **Create translation directory**:
   ```bash
   mkdir -p frontend/src/i18n/locales/en
   ```

2. **Copy and translate files**:
   ```bash
   cp frontend/src/i18n/locales/de/*.json frontend/src/i18n/locales/en/
   # Then translate each file to English
   ```

3. **Update configuration** (`frontend/src/i18n/config.ts`):
   ```typescript
   // Import English translations
   import commonEN from './locales/en/common.json';
   import navigationEN from './locales/en/navigation.json';
   // ... import other namespaces
   
   // Update resources
   resources: {
     de: { /* ... */ },
     en: {
       common: commonEN,
       navigation: navigationEN,
       // ... other namespaces
     }
   }
   ```

4. **Add language switcher** (optional):
   ```typescript
   import { useTranslation } from 'react-i18next';
   
   function LanguageSwitcher() {
     const { i18n } = useTranslation();
     
     return (
       <select 
         value={i18n.language} 
         onChange={(e) => i18n.changeLanguage(e.target.value)}
       >
         <option value="de">Deutsch</option>
         <option value="en">English</option>
       </select>
     );
   }
   ```

## Testing

The i18n configuration is automatically initialized when importing the i18n module. Tests will use the German translations by default.

To test with a specific language:

```typescript
import i18n from '../i18n';

beforeEach(() => {
  i18n.changeLanguage('de');
});
```

## Best Practices

1. **Always use translation keys**: Never hardcode user-facing text in components
2. **Keep translations close to usage**: Organize by page/feature for maintainability
3. **Avoid over-nesting**: Maximum 3 levels deep in JSON structure
4. **Document special formats**: Add comments for complex interpolations
5. **Test missing keys**: Check browser console in development for missing translation keys
6. **Consistent terminology**: Use the same terms across all translations

## Common Patterns

### Conditional Text

```typescript
const { t } = useTranslation('crops');

const label = crop.perennial === true 
  ? t('perennial') 
  : crop.perennial === false 
  ? t('annual') 
  : t('unknown');
```

### Dynamic Messages

```typescript
const { t } = useTranslation('crops');

// Translation: "harvestWindowValue": "{{first}}–{{last}} Tage nach der Aussaat"
const message = t('fields.harvestWindowValue', { 
  first: 60, 
  last: 90 
});
```

### Form Validation

```typescript
const { t } = useTranslation(['locations', 'common']);

const validateRow = (row) => {
  if (!row.name || row.name.trim() === '') {
    return t('locations:validation.nameRequired');
  }
  return null;
};
```

## Maintenance

- Review translation files regularly for consistency
- Remove unused translation keys
- Keep all language files in sync (same structure)
- Use TypeScript for type safety when adding new features

## Future Enhancements

Planned improvements for the i18n system:

1. **Language persistence**: Store user's language preference in localStorage
2. **Lazy loading**: Load translation files on demand for better performance
3. **Translation management**: Consider using a service like Lokalise or Crowdin
4. **Pluralization**: Add support for plural forms where needed
5. **Date/Number formatting**: Locale-specific formatting using i18n configuration
