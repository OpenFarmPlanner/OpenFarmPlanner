import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlantingPlanHierarchy } from '../pages/usePlantingPlanHierarchy';

const apiMocks = vi.hoisted(() => ({
  cropListAll: vi.fn(),
  locationListAll: vi.fn(),
  fieldListAll: vi.fn(),
  bedListAll: vi.fn(),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    cropAPI: {
      ...actual.cropAPI,
      listAll: apiMocks.cropListAll,
    },
    locationAPI: {
      ...actual.locationAPI,
      listAll: apiMocks.locationListAll,
    },
    fieldAPI: {
      ...actual.fieldAPI,
      listAll: apiMocks.fieldListAll,
    },
    bedAPI: {
      ...actual.bedAPI,
      listAll: apiMocks.bedListAll,
    },
  };
});

describe('usePlantingPlanHierarchy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.cropListAll.mockResolvedValue({
      results: [
        {
          id: 1,
          name: 'Ackerbohne',
          crop_display_name: 'Broad bean',
          variety: 'Hangdown',
        },
      ],
    });
    apiMocks.locationListAll.mockResolvedValue({ results: [] });
    apiMocks.fieldListAll.mockResolvedValue({ results: [] });
    apiMocks.bedListAll.mockResolvedValue({ results: [] });
  });

  it('uses localized crop labels for planting-plan crop options', async () => {
    const { result } = renderHook(() => usePlantingPlanHierarchy(false));

    await waitFor(() => expect(result.current.isHierarchyLoading).toBe(false));

    expect(result.current.cropOptions).toEqual([
      { value: 1, label: 'Broad bean (Hangdown)' },
    ]);
  });
});
