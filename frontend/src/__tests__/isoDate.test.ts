import { describe, expect, it } from 'vitest';
import { addUtcDays, formatIsoDate, parseIsoDate } from '../utils/isoDate';

describe('formatIsoDate', () => {
  it('formats a UTC date as YYYY-MM-DD', () => {
    expect(formatIsoDate(new Date(Date.UTC(2024, 4, 3)))).toBe('2024-05-03');
  });

  it('ignores the time-of-day component', () => {
    expect(formatIsoDate(new Date(Date.UTC(2024, 0, 9, 23, 59, 59)))).toBe('2024-01-09');
  });
});

describe('parseIsoDate', () => {
  it('parses an ISO date into a UTC date', () => {
    const parsed = parseIsoDate('2024-05-03');
    expect(parsed?.getTime()).toBe(Date.UTC(2024, 4, 3));
  });

  it('returns null for empty or nullish input', () => {
    expect(parseIsoDate('')).toBeNull();
    expect(parseIsoDate(null)).toBeNull();
    expect(parseIsoDate(undefined)).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(parseIsoDate('not-a-date')).toBeNull();
  });

  it('round-trips with formatIsoDate', () => {
    expect(formatIsoDate(parseIsoDate('2023-12-31') as Date)).toBe('2023-12-31');
  });
});

describe('addUtcDays', () => {
  it('adds days across a month boundary in UTC', () => {
    expect(formatIsoDate(addUtcDays(new Date(Date.UTC(2024, 0, 30)), 3))).toBe('2024-02-02');
  });

  it('subtracts days with a negative offset', () => {
    expect(formatIsoDate(addUtcDays(new Date(Date.UTC(2024, 2, 1)), -1))).toBe('2024-02-29');
  });

  it('does not mutate the input date', () => {
    const original = new Date(Date.UTC(2024, 0, 1));
    addUtcDays(original, 5);
    expect(original.getTime()).toBe(Date.UTC(2024, 0, 1));
  });
});
