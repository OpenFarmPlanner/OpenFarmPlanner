// UTC-based helpers for the ISO calendar-date format (YYYY-MM-DD) used across
// planning data. Everything stays in UTC so date math never shifts a day across
// DST boundaries or the viewer's local timezone.

/** Formats a Date as an ISO calendar date (YYYY-MM-DD) in UTC. */
export function formatIsoDate(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Parses an ISO calendar date (YYYY-MM-DD) into a UTC Date, or returns null for
 * empty or invalid input.
 */
export function parseIsoDate(value?: string | null): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Returns a new Date shifted by the given number of days in UTC. */
export function addUtcDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
