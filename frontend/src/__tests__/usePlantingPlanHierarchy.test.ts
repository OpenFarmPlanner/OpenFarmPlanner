import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlantingPlanHierarchy } from '../pages/usePlantingPlanHierarchy';

const apiMocks = vi.hoisted(() => ({
  cultureListAll: vi.fn(),
  locationListAll: vi.fn(),
  fieldListAll: vi.fn(),
  bedListAll: vi.fn(),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    cultureAPI: {
      ...actual.cultureAPI,
      listAll: apiMocks.cultureListAll,
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
    apiMocks.cultureListAll.mockResolvedValue({
      results: [
        {
          id: 1,
          name: 'Ackerbohne',
          culture_display_name: 'Broad bean',
          variety: 'Hangdown',
        },
      ],
    });
    apiMocks.locationListAll.mockResolvedValue({ results: [] });
    apiMocks.fieldListAll.mockResolvedValue({ results: [] });
    apiMocks.bedListAll.mockResolvedValue({ results: [] });
  });

  it('uses localized crop labels for planting-plan culture options', async () => {
    const { result } = renderHook(() => usePlantingPlanHierarchy(false));

    await waitFor(() => expect(result.current.isHierarchyLoading).toBe(false));

    expect(result.current.cultureOptions).toEqual([
      { value: 1, label: 'Broad bean (Hangdown)' },
    ]);
  });
});
