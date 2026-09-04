import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Crop, PublicCrop } from '../api/types';
import {
  buildPublishVarietyCandidates,
  findExistingPublicVariety,
  publishSelectedVarieties,
} from '../crops/publishVarieties';

const { linkPublicCropMock, publishPublicMock } = vi.hoisted(() => ({
  linkPublicCropMock: vi.fn(),
  publishPublicMock: vi.fn(),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    cropAPI: {
      ...actual.cropAPI,
      linkPublicCrop: linkPublicCropMock,
      publishPublic: publishPublicMock,
    },
  };
});

const publicCrop = (id: number, variety: string): PublicCrop => ({
  id,
  status: 'published',
  name: 'Tomate',
  variety,
  crop_species: 1,
  version: 1,
});

const variety = (id: number, name: string, overrides: Partial<Crop> = {}): Crop => ({
  id,
  name: 'Tomate',
  variety: name,
  ...overrides,
});

describe('findExistingPublicVariety', () => {
  it('matches an identical variety name', () => {
    expect(findExistingPublicVariety(variety(1, 'Roma'), [publicCrop(40, 'Roma')])?.id).toBe(40);
  });

  it('matches a near-identical spelling', () => {
    expect(findExistingPublicVariety(variety(1, 'roma '), [publicCrop(40, 'Roma')])?.id).toBe(40);
    expect(findExistingPublicVariety(variety(1, 'Romo'), [publicCrop(40, 'Roma')])?.id).toBe(40);
  });

  it('keeps a longer, distinct variety name separate', () => {
    expect(findExistingPublicVariety(variety(1, 'Roma Rispen'), [publicCrop(40, 'Roma')])).toBeNull();
  });

  it('ignores general (varietyless) public entries', () => {
    expect(findExistingPublicVariety(variety(1, 'Roma'), [publicCrop(40, '')])).toBeNull();
  });
});

describe('buildPublishVarietyCandidates', () => {
  it('offers the project Sorten with their matching public entry', () => {
    const candidates = buildPublishVarietyCandidates(
      [variety(2, 'Roma'), variety(3, 'Ochsenherz')],
      [publicCrop(40, 'Roma')],
    );

    expect(candidates.map((candidate) => [candidate.cropId, candidate.label, candidate.existingPublicCrop?.id ?? null]))
      .toEqual([[2, 'Roma', 40], [3, 'Ochsenherz', null]]);
  });

  it('skips Sorten that are already connected to the library', () => {
    const candidates = buildPublishVarietyCandidates(
      [
        variety(2, 'Roma', { owned_public_crop_id: 40 }),
        variety(3, 'Ochsenherz', { source_public_crop: 41 }),
        variety(4, 'San Marzano'),
      ],
      [],
    );

    expect(candidates.map((candidate) => candidate.cropId)).toEqual([4]);
  });
});

describe('publishSelectedVarieties', () => {
  beforeEach(() => {
    linkPublicCropMock.mockReset();
    linkPublicCropMock.mockResolvedValue({ data: {} });
    publishPublicMock.mockReset();
    publishPublicMock.mockResolvedValue({ data: {} });
  });

  it('publishes new Sorten and links the ones that already exist', async () => {
    const result = await publishSelectedVarieties({
      varieties: [
        { cropId: 2, publicCropId: 40 },
        { cropId: 3, publicCropId: null },
      ],
      cropSpeciesId: 1,
      originalLanguageCode: 'de',
    });

    expect(linkPublicCropMock).toHaveBeenCalledWith(2, 40);
    expect(publishPublicMock).toHaveBeenCalledWith(3, {
      accepted_public_library_terms: false,
      crop_species_id: 1,
      original_language_code: 'de',
    });
    expect(result).toEqual({ published: 1, linked: 1, failed: 0 });
  });

  it('keeps going when a single Sorte fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    publishPublicMock.mockRejectedValueOnce(new Error('nope'));

    const result = await publishSelectedVarieties({
      varieties: [
        { cropId: 2, publicCropId: null },
        { cropId: 3, publicCropId: null },
      ],
      originalLanguageCode: 'de',
    });

    expect(publishPublicMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ published: 1, linked: 0, failed: 1 });
  });
});
