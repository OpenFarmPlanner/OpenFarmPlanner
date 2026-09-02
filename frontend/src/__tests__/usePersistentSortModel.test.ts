import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GridFilterModel } from '@mui/x-data-grid';
import { usePersistentSortModel } from '../hooks/usePersistentSortModel';

const allowedFields = ['planting_date', 'crop', 'bed'];

describe('usePersistentSortModel', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState(null, '', '/planting-plans');
  });

  it('persists sort and filter state to the same table scope', () => {
    const { result } = renderHook(() =>
      usePersistentSortModel({
        tableKey: 'plantingPlans',
        allowedFields,
        defaultSortModel: [{ field: 'planting_date', sort: 'asc' }],
      }),
    );

    const nextFilterModel: GridFilterModel = {
      items: [{ id: 1, field: 'crop', operator: 'contains', value: 'Tomate' }],
    };

    act(() => {
      result.current.setSortModel([{ field: 'bed', sort: 'desc' }]);
      result.current.setFilterModel(nextFilterModel);
    });

    expect(JSON.parse(window.sessionStorage.getItem('tableSort.plantingPlans') ?? '[]')).toEqual([
      { field: 'bed', sort: 'desc' },
    ]);
    expect(JSON.parse(window.sessionStorage.getItem('tableFilter.plantingPlans') ?? '{}')).toEqual(
      nextFilterModel,
    );
    expect(new URLSearchParams(window.location.search).get('sort_plantingPlans')).toBe('bed');
    expect(new URLSearchParams(window.location.search).get('dir_plantingPlans')).toBe('desc');
    expect(
      JSON.parse(new URLSearchParams(window.location.search).get('filter_plantingPlans') ?? '{}'),
    ).toEqual(nextFilterModel);
  });

  it('hydrates filter state from the url before session storage', () => {
    const storedFilterModel: GridFilterModel = {
      items: [{ id: 1, field: 'bed', operator: 'contains', value: 'Nord' }],
    };
    const urlFilterModel: GridFilterModel = {
      items: [{ id: 2, field: 'crop', operator: 'contains', value: 'Salat' }],
    };
    window.sessionStorage.setItem('tableFilter.plantingPlans', JSON.stringify(storedFilterModel));
    window.history.replaceState(
      null,
      '',
      `/planting-plans?filter_plantingPlans=${encodeURIComponent(JSON.stringify(urlFilterModel))}`,
    );

    const { result } = renderHook(() =>
      usePersistentSortModel({
        tableKey: 'plantingPlans',
        allowedFields,
      }),
    );

    expect(result.current.filterModel).toEqual(urlFilterModel);
  });

  it('clears persisted filter state when filters are removed', () => {
    window.history.replaceState(
      null,
      '',
      `/planting-plans?filter_plantingPlans=${encodeURIComponent(
        JSON.stringify({ items: [{ id: 1, field: 'crop', operator: 'contains', value: 'Tomate' }] }),
      )}`,
    );
    const { result } = renderHook(() =>
      usePersistentSortModel({
        tableKey: 'plantingPlans',
        allowedFields,
      }),
    );

    act(() => {
      result.current.setFilterModel({ items: [] });
    });

    expect(result.current.filterModel).toEqual({ items: [] });
    expect(JSON.parse(window.sessionStorage.getItem('tableFilter.plantingPlans') ?? '{}')).toEqual({
      items: [],
    });
    expect(new URLSearchParams(window.location.search).has('filter_plantingPlans')).toBe(false);
  });
});
