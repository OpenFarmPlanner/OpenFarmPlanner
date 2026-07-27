import { describe, expect, it } from 'vitest';
import {
  formatCompactYield,
  formatDateToAPI,
  formatIsoWeek,
  getYieldAxisLabelStep,
  mergeCultureYields,
  type YieldCalendarCulture,
} from '../pages/yieldOverviewUtils';

describe('formatCompactYield', () => {
  it('keeps one fraction digit for small values', () => {
    expect(formatCompactYield(4.25, 'en-US')).toBe('4.3');
  });

  it('drops fraction digits for values of ten or more', () => {
    expect(formatCompactYield(12.7, 'en-US')).toBe('13');
  });
});

describe('formatDateToAPI', () => {
  it('formats a date as YYYY-MM-DD with zero padding', () => {
    expect(formatDateToAPI(new Date(2024, 0, 5))).toBe('2024-01-05');
  });
});

describe('formatIsoWeek', () => {
  it('returns the ISO week for a mid-year date', () => {
    // 2024-01-04 falls in ISO week 1.
    expect(formatIsoWeek(new Date(2024, 0, 4))).toBe('2024-W01');
  });

  it('assigns the last days of the year to the first ISO week when applicable', () => {
    // 2019-12-30 belongs to ISO week 1 of 2020.
    expect(formatIsoWeek(new Date(2019, 11, 30))).toBe('2020-W01');
  });
});

describe('mergeCultureYields', () => {
  it('sums yields for entries sharing a culture id', () => {
    const cultures = [
      { culture_id: 1, yield: 2 },
      { culture_id: 2, yield: 5 },
      { culture_id: 1, yield: 3 },
    ] as unknown as YieldCalendarCulture[];

    const merged = mergeCultureYields(cultures);

    expect(merged).toHaveLength(2);
    expect(merged.find((entry) => entry.culture_id === 1)?.yield).toBe(5);
    expect(merged.find((entry) => entry.culture_id === 2)?.yield).toBe(5);
  });
});

describe('getYieldAxisLabelStep', () => {
  it('returns 1 when there is enough room per column', () => {
    expect(getYieldAxisLabelStep(1000, 10, 'week')).toBe(1);
  });

  it('increases the step when columns get too narrow', () => {
    expect(getYieldAxisLabelStep(100, 20, 'week')).toBeGreaterThan(1);
  });
});
