import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from '../utils/relativeTime';

const NOW = new Date('2026-08-16T12:00:00Z');
const ago = (milliseconds: number): Date => new Date(NOW.getTime() - milliseconds);

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatRelativeTime', () => {
  it('keeps the count visible instead of collapsing it into "gestern"/"vorgestern"', () => {
    expect(formatRelativeTime(ago(2 * DAY), 'de', NOW)).toBe('vor 2 Tagen');
    expect(formatRelativeTime(ago(DAY), 'de', NOW)).toBe('vor 1 Tag');
  });

  it('picks the largest fitting unit', () => {
    expect(formatRelativeTime(ago(3 * MINUTE), 'de', NOW)).toBe('vor 3 Minuten');
    expect(formatRelativeTime(ago(5 * HOUR), 'de', NOW)).toBe('vor 5 Stunden');
    expect(formatRelativeTime(ago(10 * DAY), 'de', NOW)).toBe('vor 1 Woche');
    expect(formatRelativeTime(ago(400 * DAY), 'de', NOW)).toBe('vor 1 Jahr');
  });

  it('follows the requested language', () => {
    expect(formatRelativeTime(ago(2 * DAY), 'en', NOW)).toBe('2 days ago');
  });

  it('says "now" instead of "0 seconds ago" for anything under a minute', () => {
    expect(formatRelativeTime(ago(10 * 1000), 'en', NOW)).toBe('now');
  });

  it('renders nothing for an unparsable timestamp rather than "Invalid Date"', () => {
    expect(formatRelativeTime('not-a-date', 'de', NOW)).toBe('');
  });
});
