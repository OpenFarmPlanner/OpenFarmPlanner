import { describe, expect, it } from 'vitest';
import type { PublicCulture } from '../api/types';
import { applySavedCultures } from '../crops/publicCultureListMerge';

const culture = (id: number, version: number, growthDurationDays: number): PublicCulture => ({
  id,
  version,
  growth_duration_days: growthDurationDays,
} as PublicCulture);

describe('applySavedCultures', () => {
  it('returns the list untouched when nothing was saved locally', () => {
    const results = [culture(1, 1, 70)];

    expect(applySavedCultures(results, new Map())).toBe(results);
  });

  it('keeps a saved culture when the list response predates the save', () => {
    const saved = new Map([[1, culture(1, 2, 48)]]);

    const applied = applySavedCultures([culture(1, 1, 70), culture(2, 1, 30)], saved);

    expect(applied.map((entry) => entry.growth_duration_days)).toEqual([48, 30]);
  });

  it('lets the server win once it returns the saved version', () => {
    const saved = new Map([[1, culture(1, 2, 48)]]);

    const applied = applySavedCultures([culture(1, 2, 48)], saved);

    expect(applied[0].version).toBe(2);
    // The override has served its purpose and must not outlive the response
    // it was protecting against, or later server-side edits would be ignored.
    expect(saved.has(1)).toBe(false);
  });

  it('lets a newer server version replace the saved one and drops the override', () => {
    const saved = new Map([[1, culture(1, 2, 48)]]);

    const applied = applySavedCultures([culture(1, 3, 55)], saved);

    expect(applied[0].growth_duration_days).toBe(55);
    expect(saved.has(1)).toBe(false);
  });

  it('leaves cultures that were never saved locally alone', () => {
    const saved = new Map([[1, culture(1, 2, 48)]]);

    const applied = applySavedCultures([culture(9, 1, 12)], saved);

    expect(applied[0].growth_duration_days).toBe(12);
    expect(saved.has(1)).toBe(true);
  });
});
