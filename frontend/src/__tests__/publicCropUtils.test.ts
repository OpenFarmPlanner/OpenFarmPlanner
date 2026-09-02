import { describe, expect, it } from 'vitest';
import type { PublicCrop } from '../api/types';
import { dedupePublicCrops } from '../pages/publicCropUtils';

const buildPublicCrop = (overrides: Partial<PublicCrop>): PublicCrop => ({
  id: 1,
  status: 'published',
  name: 'Möhre',
  version: 1,
  published_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('publicCropUtils', () => {
  it('keeps newest publication per normalized identity', () => {
    const entries = [
      buildPublicCrop({ id: 3, name: ' MöHre ', variety: 'Nantaise', published_at: '2026-01-10T00:00:00.000Z' }),
      buildPublicCrop({ id: 4, name: 'möhre', variety: 'Nantaise', published_at: '2026-01-20T00:00:00.000Z' }),
      buildPublicCrop({ id: 5, name: 'Möhre', variety: 'Other Variety', published_at: '2026-01-15T00:00:00.000Z' }),
    ];

    const deduped = dedupePublicCrops(entries);

    expect(deduped).toHaveLength(2);
    expect(deduped.map((entry) => entry.id)).toContain(4);
    expect(deduped.map((entry) => entry.id)).toContain(5);
  });

  it('uses id as tie-breaker when publication timestamp is identical', () => {
    const entries = [
      buildPublicCrop({ id: 8, name: 'Salat', variety: 'Batavia', published_at: '2026-02-01T00:00:00.000Z' }),
      buildPublicCrop({ id: 12, name: 'Salat', variety: 'Batavia', published_at: '2026-02-01T00:00:00.000Z' }),
    ];

    const deduped = dedupePublicCrops(entries);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].id).toBe(12);
  });

  it('deduplicates entries that only differ by supplier, since supplier is not part of public identity', () => {
    const entries = [
      buildPublicCrop({ id: 20, name: 'Möhre', variety: 'Nantaise', published_at: '2026-01-10T00:00:00.000Z' }),
      buildPublicCrop({ id: 21, name: 'Möhre', variety: 'Nantaise', published_at: '2026-01-20T00:00:00.000Z' }),
    ];

    const deduped = dedupePublicCrops(entries);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].id).toBe(21);
  });
});
