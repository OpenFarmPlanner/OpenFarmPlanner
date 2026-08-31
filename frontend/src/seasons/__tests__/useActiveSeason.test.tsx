import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useActiveSeason } from '../useActiveSeason';
import type { Season } from '../../api/types';

const { listMock, dueMock, deleteMock, undeleteMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  dueMock: vi.fn(),
  deleteMock: vi.fn(),
  undeleteMock: vi.fn(),
}));

vi.mock('../../api/api', () => ({
  seasonAPI: {
    list: listMock,
    dueSuggestion: dueMock,
    delete: deleteMock,
    undelete: undeleteMock,
    create: vi.fn(),
    update: vi.fn(),
    copyFrom: vi.fn(),
  },
}));

vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ activeProjectId: 1 }) }));

function season(id: number, start: string, end: string): Season {
  return {
    id, project: 1, start_date: start, end_date: end, custom_label: '',
    label: `s${id}`, computed_label: `s${id}`, planting_plan_count: 0,
    created_at: '', updated_at: '',
  };
}

const seasons = [
  season(3, '2026-09-01', '2027-08-31'),
  season(2, '2025-09-01', '2026-08-31'),
  season(1, '2024-09-01', '2025-08-31'),
];

const reloadMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  listMock.mockResolvedValue({ data: { results: seasons } });
  dueMock.mockResolvedValue({ data: { due: false } });
  deleteMock.mockResolvedValue({});
  undeleteMock.mockResolvedValue({ data: seasons[1] });
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload: reloadMock },
    writable: true,
  });
});

describe('useActiveSeason', () => {
  it('persists the resolved fallback season id so the X-Season-Id header never goes missing', async () => {
    const { result } = renderHook(() => useActiveSeason());
    await waitFor(() => expect(result.current.activeSeason?.id).toBe(3));
    expect(window.localStorage.getItem('activeSeasonId:1')).toBe('3');
  });

  it('deleting the active season points the stored id at the next season, reloads, and keeps the undo', async () => {
    window.localStorage.setItem('activeSeasonId:1', '3');
    const { result } = renderHook(() => useActiveSeason());
    await waitFor(() => expect(result.current.seasons).toHaveLength(3));

    await act(async () => {
      await result.current.deleteSeason(seasons[0]);
    });

    expect(deleteMock).toHaveBeenCalledWith(3);
    expect(window.localStorage.getItem('activeSeasonId:1')).toBe('2');
    expect(reloadMock).toHaveBeenCalled();
    const stashed = JSON.parse(window.sessionStorage.getItem('pendingSeasonDeletions') ?? '[]');
    expect(stashed).toHaveLength(1);
    expect(stashed[0]).toMatchObject({ seasonId: 3, restoreAsActive: true });
  });

  it('deleting a non-active season shows the undo snackbar without reloading', async () => {
    window.localStorage.setItem('activeSeasonId:1', '3');
    const { result } = renderHook(() => useActiveSeason());
    await waitFor(() => expect(result.current.seasons).toHaveLength(3));

    await act(async () => {
      await result.current.deleteSeason(seasons[1]);
    });

    expect(reloadMock).not.toHaveBeenCalled();
    expect(result.current.pendingDeletions).toHaveLength(1);
    expect(result.current.pendingDeletions[0]).toMatchObject({ seasonId: 2, restoreAsActive: false });
  });

  it('rehydrates a stashed deletion after the reload and restores it as active on undo', async () => {
    window.localStorage.setItem('activeSeasonId:1', '2');
    window.sessionStorage.setItem('pendingSeasonDeletions', JSON.stringify([
      { id: 'x', seasonId: 3, message: 'gone', expiresAt: Date.now() + 10_000, restoreAsActive: true },
    ]));

    const { result } = renderHook(() => useActiveSeason());
    await waitFor(() => expect(result.current.pendingDeletions).toHaveLength(1));

    await act(async () => {
      await result.current.undoPendingDeletion('x');
    });

    expect(undeleteMock).toHaveBeenCalledWith(3);
    expect(window.localStorage.getItem('activeSeasonId:1')).toBe('3');
    expect(reloadMock).toHaveBeenCalled();
    // The stashed entry is cleared synchronously before the reload, so the
    // snackbar does not come back for the already-restored season.
    expect(JSON.parse(window.sessionStorage.getItem('pendingSeasonDeletions') ?? '[]')).toHaveLength(0);
  });
});
