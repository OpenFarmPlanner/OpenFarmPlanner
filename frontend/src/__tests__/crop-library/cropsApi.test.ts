import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock('../../api/httpClient', () => ({
  default: {
    get: getMock,
  },
}));

import { cropsApi } from '../../crop-library/api/cropsApi';

describe('cropsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists crops from the /crops/ endpoint', async () => {
    getMock.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });

    await cropsApi.list({ q: 'lettuce' });

    expect(getMock).toHaveBeenCalledWith('/crop-library/', { params: { q: 'lettuce' } });
  });

  it('retrieves a single crop by id', async () => {
    getMock.mockResolvedValue({ data: { id: 1, name: 'Lettuce' } });

    await cropsApi.get(1);

    expect(getMock).toHaveBeenCalledWith('/crop-library/1/');
  });

  it('checks for an exact match', async () => {
    getMock.mockResolvedValue({ data: { exists: false, crop: null } });

    await cropsApi.match({ name: 'Lettuce', variety: 'Bijella' });

    expect(getMock).toHaveBeenCalledWith('/crop-library/match/', { params: { name: 'Lettuce', variety: 'Bijella' }, signal: undefined });
  });
});
