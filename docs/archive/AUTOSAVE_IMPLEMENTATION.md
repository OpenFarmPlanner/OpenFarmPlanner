# Autosave Implementation Documentation (archived)

> **Archived snapshot — do not use as a reference.** The still-valid parts of
> this document (the `useAutosaveDraft`/`useNavigationBlocker` hooks, the
> validation utilities, the navigation-protection and MUI-integration
> mechanics) were consolidated into
> [`docs/datagrid-architecture.md`](../datagrid-architecture.md), which is now
> the single source for this topic. The rest — chiefly the "Applied To"
> section — describes the feature *as originally implemented* and is outdated:
> `Locations.tsx` and `CultureForm.tsx` no longer use `useAutosaveDraft` (both
> moved to explicit dialog Save/Cancel forms), and `Beds.tsx`/`Fields.tsx` no
> longer exist as separate pages (merged into
> `FieldsBedsPage.tsx`/`FieldsBedsHierarchy.tsx`, which use a raw MUI
> `DataGrid`, not `EditableDataGrid`). This file is kept only so the original
> reasoning stays retrievable.

## Overview

This document describes the spreadsheet-like autosave functionality implemented across the OpenFarmPlanner frontend.

## Features

### Core Functionality

1. **Draft-First Editing**: All user input is captured in local draft state immediately, without server calls on every keystroke.

2. **Autosave on Blur**: Data is automatically saved when the user leaves a field (onBlur event):
   - For forms: Each field saves when focus moves away
   - For data grids: Each row saves when user clicks outside the row, tabs away, or clicks another row
   
3. **Validation Before Save**: 
   - Invalid data is never sent to the server
   - Validation errors are displayed clearly to the user
   - Only valid data triggers a save operation

4. **Navigation Protection**:
   - Browser navigation (tab close/reload) warns if there are unsaved changes
   - React Router navigation can run a save callback before continuing
   - EditableDataGrid uses this to save dirty rows silently before route changes

5. **Race-Safe Operations**:
   - Multiple rapid save operations are handled safely
   - In-flight saves are cancelled when newer changes are made
   - Latest draft always takes precedence

## Implementation

### Core Hooks

#### `useAutosaveDraft<T>`

Main hook for form-level autosave. Provides:

```typescript
const {
  draft,              // Current draft state
  setField,           // Update single field
  updateDraft,        // Update multiple fields
  errors,             // Current validation errors
  isDirty,            // Has unsaved changes
  isValid,            // Current validation state
  isSaving,           // Save in progress
  saveIfValid,        // Manually trigger save
  resetDraft,         // Reset to saved state
  commitSavedState,   // Update saved state after server response
} = useAutosaveDraft({
  initialData,
  validate,
  save,
  onSaveSuccess,
  onSaveError,
});
```

**Usage Example:**

```typescript
const validateCulture = (draft: Partial<Culture>): ValidationResult => {
  const errors: Record<string, string> = {};
  if (!draft.name) {
    errors.name = 'Name is required';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
};

const saveCulture = async (draft: Partial<Culture>): Promise<Partial<Culture>> => {
  await cultureAPI.update(draft.id, draft);
  return draft;
};

const {
  draft,
  setField,
  errors,
  saveIfValid,
} = useAutosaveDraft({
  initialData: culture,
  validate: validateCulture,
  save: saveCulture,
});

// In form field
<TextField
  value={draft.name}
  onChange={(e) => setField('name', e.target.value)}
  onBlur={() => saveIfValid('blur')}
  error={Boolean(errors.name)}
  helperText={errors.name}
/>
```

#### `useNavigationBlocker`

Hook for blocking navigation when there are unsaved changes:

```typescript
useNavigationBlocker(
  isDirty && !isValid,  // Block condition
  'You have unsaved changes. Are you sure you want to leave?',
  saveBeforeLeaving,
  false, // skip confirm dialog for in-app navigation
);
```

### Validation Utilities

Located in `src/hooks/validation.ts`:

- `required` - Check for non-empty values
- `min(n)` - Minimum numeric value
- `max(n)` - Maximum numeric value
- `hexColor` - Hex color format validation
- `isoDate` - ISO date format validation
- `email` - Email format validation
- `positive` - Positive numbers only
- `nonNegative` - Non-negative numbers
- `oneOf(values)` - Value must be in list
- `maxLength(n)` - Maximum string length
- `minLength(n)` - Minimum string length
- `validateFields` - Validate multiple fields at once

**Usage Example:**

```typescript
import { validateFields, required, nonNegative } from '../hooks/validation';

const validations = [
  { field: 'name', validators: [required] },
  { field: 'age', validators: [required, nonNegative] },
];

const result = validateFields(data, validations);
// result = { isValid: boolean, errors: Record<string, string> }
```

## Applied To

> This section describes the state of the feature **as originally implemented**. As of 2026-07 it is only partially accurate — see the status note at the top of this file and [`docs/datagrid-architecture.md`](../datagrid-architecture.md) for what's current.

### Forms

#### CultureForm (`src/cultures/CultureForm.tsx`)

Originally moved to save-on-blur; **currently uses an explicit dialog Save/Cancel flow instead** (its own code comments say "Local form state (no autosave)"). If you need blur-based autosave for a form again, `useAutosaveDraft`/`useNavigationBlocker` are still the hooks to reach for — just verify current form behavior in the component before assuming it still applies here.

### Data Grids

#### EditableDataGrid (`src/components/data-grid/DataGrid.tsx`)

- **Before**: Required pressing Enter to save row
- **After**: Row saves automatically on:
  - Clicking outside the row
  - Pressing Tab to move to another field
  - Clicking another row
- **Navigation**: In-app route changes save dirty/editing rows before navigation continues; browser tab close/reload still gets native `beforeunload` protection
- **Validation**: Invalid rows cannot be saved (error shown to user, row stays in edit mode)
- **Data Protection**: Dirty rows are saved before navigation. Save failures keep inline validation/errors available when the user returns to the row.

**Pages currently using `EditableDataGrid`:** `PlantingPlans.tsx` is the only page using it today. `Locations.tsx` moved to a card/dialog form (not a grid), and `FieldsBedsHierarchy.tsx` renders a raw MUI `DataGrid` directly (see [`docs/datagrid-architecture.md`](../datagrid-architecture.md)) rather than `EditableDataGrid`, so it does not get this autosave behavior automatically.

### Not Changed

`Beds.tsx`/`Fields.tsx` as separate pages no longer exist — fields and beds are now managed through `FieldsBedsPage.tsx`/`FieldsBedsHierarchy.tsx`/`GraphicalFields.tsx`.

These are simple create-only forms where the manual save button provides clear user intent without the complexity of autosave.

## Testing

### Unit Tests

Located in `src/__tests__/`:

1. **`validation.test.ts`** - 30 tests for validation utilities
2. **`useAutosaveDraft.test.ts`** - 11 tests for autosave hook

All tests passing (41 total).

**Test Coverage:**
- Validation of required fields
- Validation of numeric constraints
- Validation of format constraints (email, hex color, ISO date)
- Draft state management
- Field updates and change tracking
- Save triggering and error handling
- Navigation blocking behavior

### Running Tests

```bash
cd frontend
npm run test
```

## User Experience

### Forms (e.g., Culture Form)

1. User clicks on a field → enters edit mode
2. User types → draft state updates locally (no server calls)
3. User clicks outside field or tabs away → triggers validation
4. If valid → automatic save to server
5. If invalid → error message shown, no server call
6. User tries to navigate away with invalid data → confirmation dialog

### Data Grids (e.g., Planting Plans)

1. User clicks on a cell → row enters edit mode
2. User types or selects from dropdown → changes are tracked locally
3. User clicks outside the row, tabs away, or clicks a different in-app route → triggers a save attempt
4. For planting plans, incomplete rows can be saved as drafts as long as either a culture or a bed is selected
5. If valid → automatic save to server, row exits edit mode, navigation proceeds when applicable
6. If invalid → detailed error message is shown and the row stays editable

### Key Improvements

- **No Enter key required** - More intuitive, spreadsheet-like behavior
- **Clear validation feedback** - Errors shown immediately on blur with specific field names
- **Silent in-app navigation saves** - Route changes save dirty grid rows first without showing a confirmation dialog
- **Dropdown selection support** - Selecting from dropdowns properly updates validation state
- **Complete data protection** - Cannot accidentally lose work or navigate away with invalid data
- **Better performance** - No server calls while typing
- **Graceful error handling** - Server errors don't lose user's work
- **Internationalized messages** - All user-facing messages in German (or configured language)
- **Navigation save callback** - Lets grids persist current edits before route changes
- **Detailed error messages** - Shows exactly which fields need to be filled
- **Draft row support** - Planting plans can persist partial rows without forcing cultivation type selection

## Technical Details

### beforeunload Handling

The `useAutosaveDraft` hook automatically sets up `beforeunload` event listeners to warn users about unsaved changes:

```typescript
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (isDirty && isValid) {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes...';
    }
  };
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [isDirty, isValid]);
```

### React Router Navigation Blocking

The `useNavigationBlocker` hook provides comprehensive navigation protection:

**Browser Navigation (beforeunload):**
```typescript
useEffect(() => {
  if (!shouldBlock) return;

  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = message;
    return message;
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [shouldBlock, message]);
```

**In-App Navigation (useBlocker):**
```typescript
const blocker = useBlocker(({ currentLocation, nextLocation }) => {
  return shouldBlock && currentLocation.pathname !== nextLocation.pathname;
});

useEffect(() => {
  if (blocker.state === 'blocked') {
    const proceed = confirmBeforeProceed ? window.confirm(message) : true;
    if (proceed) {
      Promise.resolve(onProceed?.()).finally(() => blocker.proceed());
    } else {
      blocker.reset();
    }
  }
}, [blocker, message, onProceed, confirmBeforeProceed]);
```

**Router Compatibility:**

This app now uses React Router's data router API (`createBrowserRouter`), which provides full support for:
- ✅ Browser tab close
- ✅ Page reload
- ✅ External navigation (typing new URL)
- ✅ In-app React Router navigation

The data router structure in `App.tsx` uses a root layout with nested routes:

```typescript
createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'locations', element: <Locations /> },
      // ... other routes
    ],
  },
], { basename });
```

### MUI DataGrid Integration

For the EditableDataGrid, autosave is implemented by allowing the default `rowFocusOut` behavior:

```typescript
// handlers.ts
export const handleRowEditStop: GridEventListener<'rowEditStop'> = (params, event): void => {
  if (params.reason === GridRowEditStopReasons.escapeKeyDown) {
    event.defaultMuiPrevented = true; // Cancel on Escape
  }
  // Allow rowFocusOut to proceed → triggers processRowUpdate → autosave
};
```

## Maintenance

### Adding Autosave to a New Form

1. Import the hook and utilities:
```typescript
import { useAutosaveDraft, useNavigationBlocker, type ValidationResult } from '../hooks/autosave';
```

2. Define validation function:
```typescript
const validate = (draft: MyType): ValidationResult => {
  const errors: Record<string, string> = {};
  // Add validation rules
  return { isValid: Object.keys(errors).length === 0, errors };
};
```

3. Define save function:
```typescript
const save = async (draft: MyType): Promise<MyType> => {
  const response = await api.save(draft);
  return response.data;
};
```

4. Use the hook:
```typescript
const {
  draft,
  setField,
  errors,
  isDirty,
  isValid,
  saveIfValid,
} = useAutosaveDraft({ initialData, validate, save });
```

5. Add navigation blocking:
```typescript
useNavigationBlocker(isDirty && !isValid, 'Unsaved changes...');
```

6. Wire up form fields:
```typescript
<TextField
  value={draft.fieldName}
  onChange={(e) => setField('fieldName', e.target.value)}
  onBlur={() => saveIfValid('blur')}
  error={Boolean(errors.fieldName)}
  helperText={errors.fieldName}
/>
```

### Adding a New Validation Rule

Add to `src/hooks/validation.ts`:

```typescript
export const myValidator: Validator<unknown> = (value, fieldName) => {
  if (/* validation fails */) {
    return `${fieldName} error message`;
  }
  return null;
};
```

## Future Enhancements

Possible improvements:

1. **Debounced Autosave**: Add optional delay before saving (currently saves immediately on blur)
2. **Offline Support**: Cache drafts in localStorage for recovery after page reload
3. **Optimistic Updates**: Show saved state immediately while request is in flight
4. **Conflict Resolution**: Handle concurrent edits by multiple users
5. **Field-Level Save Status**: Show per-field saving indicators

## References

- [React Router Blocking](https://reactrouter.com/en/main/hooks/use-blocker)
- [MUI DataGrid Edit Mode](https://mui.com/x/react-data-grid/editing/)
- [beforeunload Event](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event)
