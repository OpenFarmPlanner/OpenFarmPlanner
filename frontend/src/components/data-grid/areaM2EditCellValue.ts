import { formatLocalizedNumber } from '../../utils/numberLocalization';

/**
 * Computes the initial string shown in the area (m²) edit cell input.
 *
 * A non-numeric raw string (e.g. an in-progress "3x4" area expression) is kept
 * verbatim; numeric values are locale-formatted without grouping; otherwise a
 * numeric fallback is used, and finally an empty string.
 */
export function getInitialInputValue(
  value: unknown,
  fallbackValue: number | null | undefined,
  locale: string,
): string {
  if (typeof value === 'string' && value.trim() !== '' && Number.isNaN(Number(value))) {
    return value;
  }
  const normalizedValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : null;
  if (typeof normalizedValue === 'number' && !Number.isNaN(normalizedValue)) {
    return formatLocalizedNumber(normalizedValue, locale, {
      useGrouping: false,
      maximumFractionDigits: 2,
    });
  }
  if (typeof fallbackValue === 'number' && !Number.isNaN(fallbackValue)) {
    return formatLocalizedNumber(fallbackValue, locale, {
      useGrouping: false,
      maximumFractionDigits: 2,
    });
  }
  return '';
}
