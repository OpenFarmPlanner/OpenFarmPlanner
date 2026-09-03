// Helpers for the ISO calendar-date format (YYYY-MM-DD) used across planning
// data. Date *math* stays in UTC so it never shifts a day across DST
// boundaries or the viewer's local timezone; each function below states which
// basis it reads the date in.

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

/**
 * Formats a Date as an ISO calendar date (YYYY-MM-DD) from its *local* parts.
 *
 * The calendars build their range from local Dates (`new Date(year, 0, 1)`),
 * so reading those back in UTC would move the boundary a day for viewers west
 * of UTC. This is the date the API is sent for those ranges.
 */
export function formatDateToAPI(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
