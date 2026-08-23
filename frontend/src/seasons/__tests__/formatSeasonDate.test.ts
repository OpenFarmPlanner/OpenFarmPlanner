import { describe, expect, it } from 'vitest';
import { computeSeasonLabel, formatSeasonPeriod } from '../formatSeasonDate';

describe('computeSeasonLabel', () => {
  it('returns the four-digit year for a calendar-year season', () => {
    expect(computeSeasonLabel('2026-01-01', '2026-12-31')).toBe('2026');
  });

  it('returns a YY/YY span for a season crossing a calendar year boundary', () => {
    expect(computeSeasonLabel('2025-09-01', '2026-08-31')).toBe('25/26');
  });

  it('is hemisphere-agnostic: any non-calendar-year range gets the split label', () => {
    expect(computeSeasonLabel('2026-07-01', '2027-06-30')).toBe('26/27');
  });
});

describe('formatSeasonPeriod', () => {
  it('formats both dates with the given locale and an en dash between them', () => {
    expect(formatSeasonPeriod('2026-01-01', '2026-12-31', 'de-DE')).toBe('1.1.2026 – 31.12.2026');
  });
});
