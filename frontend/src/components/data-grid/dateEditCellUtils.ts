import { parseGermanDateText } from './GermanDateEditCell';

export const toIsoDateString = (value: unknown): string | null => {
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  return null;
};

/**
 * Coerces anything a row can hold for a `type: 'date'` column into the `Date`
 * object MUI requires. Row state keeps dates as ISO strings (that is what the
 * API returns and what `mapToRow` stores), so every value entering the grid —
 * cell values via `valueGetter` and edit-state values alike — has to pass
 * through here. Unparseable input becomes `null` instead of an `Invalid Date`,
 * so a bad value renders as an empty cell rather than throwing.
 */
export const toGridDateValue = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }
  if (typeof value === 'string') {
    const germanDate = parseGermanDateText(value);
    if (germanDate) {
      return germanDate;
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
