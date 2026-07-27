import { describe, expect, it } from 'vitest';
import type { Culture } from '../api/types';
import { getSowingMonths } from '../cultures/cultureDetailFormatters';

const culture = (overrides: Record<string, unknown>): Culture =>
  ({ name: 'Test', ...overrides }) as unknown as Culture;

describe('getSowingMonths', () => {
  it('returns the explicit month array, filtering out-of-range values', () => {
    expect(getSowingMonths(culture({ sowing_months: [0, 3, 4, 13, 12] }))).toEqual([3, 4, 12]);
  });

  it('wraps a single valid sowing month', () => {
    expect(getSowingMonths(culture({ sowing_month: 5 }))).toEqual([5]);
  });

  it('returns an empty array for an out-of-range single month', () => {
    expect(getSowingMonths(culture({ sowing_month: 0 }))).toEqual([]);
  });

  it('expands an inclusive start/end range', () => {
    expect(getSowingMonths(culture({ sowing_start_month: 3, sowing_end_month: 6 }))).toEqual([3, 4, 5, 6]);
  });

  it('normalizes a reversed start/end range', () => {
    expect(getSowingMonths(culture({ sowing_start_month: 6, sowing_end_month: 4 }))).toEqual([4, 5, 6]);
  });

  it('prefers the month array over the range shape', () => {
    expect(getSowingMonths(culture({
      sowing_months: [2],
      sowing_start_month: 5,
      sowing_end_month: 9,
    }))).toEqual([2]);
  });

  it('returns an empty array when no sowing information is present', () => {
    expect(getSowingMonths(culture({}))).toEqual([]);
  });
});
