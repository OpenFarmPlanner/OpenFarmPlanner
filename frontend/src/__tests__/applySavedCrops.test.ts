import { describe, expect, it } from 'vitest';
import type { PublicCrop, PublicCropDiscussionTopic } from '../api/types';
import { applySavedCrops, withCreatedTopic } from '../crop-library/publicCropListMerge';

const crop = (id: number, version: number, growthDurationDays: number): PublicCrop => ({
  id,
  version,
  growth_duration_days: growthDurationDays,
} as PublicCrop);

describe('applySavedCrops', () => {
  it('returns the list untouched when nothing was saved locally', () => {
    const results = [crop(1, 1, 70)];

    expect(applySavedCrops(results, new Map())).toBe(results);
  });

  it('keeps a saved crop when the list response predates the save', () => {
    const saved = new Map([[1, crop(1, 2, 48)]]);

    const applied = applySavedCrops([crop(1, 1, 70), crop(2, 1, 30)], saved);

    expect(applied.map((entry) => entry.growth_duration_days)).toEqual([48, 30]);
  });

  it('lets the server win once it returns the saved version', () => {
    const saved = new Map([[1, crop(1, 2, 48)]]);

    const applied = applySavedCrops([crop(1, 2, 48)], saved);

    expect(applied[0].version).toBe(2);
    // The override has served its purpose and must not outlive the response
    // it was protecting against, or later server-side edits would be ignored.
    expect(saved.has(1)).toBe(false);
  });

  it('lets a newer server version replace the saved one and drops the override', () => {
    const saved = new Map([[1, crop(1, 2, 48)]]);

    const applied = applySavedCrops([crop(1, 3, 55)], saved);

    expect(applied[0].growth_duration_days).toBe(55);
    expect(saved.has(1)).toBe(false);
  });

  it('leaves crops that were never saved locally alone', () => {
    const saved = new Map([[1, crop(1, 2, 48)]]);

    const applied = applySavedCrops([crop(9, 1, 12)], saved);

    expect(applied[0].growth_duration_days).toBe(12);
    expect(saved.has(1)).toBe(true);
  });
});

const topic = (id: number, title: string): PublicCropDiscussionTopic => ({
  id,
  title,
} as PublicCropDiscussionTopic);

describe('withCreatedTopic', () => {
  it('prepends a created topic the reloaded list does not contain yet', () => {
    const reloaded = [topic(1, 'Ältere Frage')];

    expect(withCreatedTopic(reloaded, topic(2, 'Neue Frage'))).toEqual([
      topic(2, 'Neue Frage'),
      topic(1, 'Ältere Frage'),
    ]);
  });

  it('keeps the reloaded entry when the list already contains the created topic', () => {
    const reloaded = [topic(2, 'Neue Frage'), topic(1, 'Ältere Frage')];

    expect(withCreatedTopic(reloaded, topic(2, 'Veralteter Titel'))).toBe(reloaded);
  });
});
