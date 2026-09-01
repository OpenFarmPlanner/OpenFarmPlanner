/**
 * Client-side mirror of the season-period math in
 * `backend/farm/services/seasons.py` (`compute_next_pattern_start_after`,
 * `compute_custom_season_period`, `analyze_period_transition`).
 *
 * Used by the "create season" flow to preview an individual transition-season
 * period live as the user picks a start date, without a round-trip per
 * keystroke. The backend stays the source of truth for the periods that are
 * actually persisted; `seasonPeriodMath.test.ts` locks the parity.
 */

import type { SeasonPeriodTransition } from '../api/types';

function toIsoDate(value: Date): string {
  const year = String(value.getFullYear()).padStart(4, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

/** The pattern start day/month in `year`, clamped to the month length. */
function patternStartForYear(year: number, startDay: number, startMonth: number): Date {
  const day = Math.min(startDay, daysInMonth(year, startMonth));
  return new Date(year, startMonth - 1, day);
}

/** Earliest pattern start date strictly after `reference` (ISO date string). */
export function computeNextPatternStartAfter(
  reference: string,
  startDay: number,
  startMonth: number,
): string {
  const referenceDate = parseIsoDate(reference);
  let candidate = patternStartForYear(referenceDate.getFullYear(), startDay, startMonth);
  if (candidate.getTime() <= referenceDate.getTime()) {
    candidate = patternStartForYear(referenceDate.getFullYear() + 1, startDay, startMonth);
  }
  return toIsoDate(candidate);
}

/** End date (inclusive) for an individual season starting on `startDate`. */
export function computeCustomSeasonEnd(
  startDate: string,
  startDay: number,
  startMonth: number,
): string {
  const nextStart = parseIsoDate(computeNextPatternStartAfter(startDate, startDay, startMonth));
  nextStart.setDate(nextStart.getDate() - 1);
  return toIsoDate(nextStart);
}

/** Add `days` to an ISO date string. */
export function addDaysIso(isoDate: string, days: number): string {
  const date = parseIsoDate(isoDate);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/**
 * Classify the join between `previousEnd` and `nextStart` (both ISO dates).
 * Returns `null` when seamless.
 */
export function analyzePeriodTransition(
  previousEnd: string,
  nextStart: string,
): SeasonPeriodTransition | null {
  const seam = addDaysIso(previousEnd, 1);
  if (nextStart === seam) {
    return null;
  }
  if (nextStart > seam) {
    return { kind: 'gap', start_date: seam, end_date: addDaysIso(nextStart, -1) };
  }
  return { kind: 'overlap', start_date: nextStart, end_date: previousEnd };
}
