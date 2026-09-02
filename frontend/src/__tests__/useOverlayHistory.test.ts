import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useOverlayHistory } from '../hooks/useOverlayHistory';

describe('useOverlayHistory', () => {
  beforeEach(() => {
    window.history.replaceState({ page: 'crops' }, '', '/app/crops');
  });

  it('pushes a transient entry while the overlay is open', () => {
    renderHook(() => useOverlayHistory({
      open: true,
      onClose: vi.fn(),
      historyKey: 'testOverlay',
    }));

    expect(window.history.state).toMatchObject({
      page: 'crops',
      testOverlay: expect.any(String),
    });
  });

  it('closes the overlay when the transient entry is popped', async () => {
    const onClose = vi.fn();

    renderHook(() => useOverlayHistory({
      open: true,
      onClose,
      historyKey: 'testOverlay',
    }));

    act(() => {
      window.history.back();
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('consumes the transient entry when the overlay closes programmatically', () => {
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    const { rerender } = renderHook(
      ({ open }) => useOverlayHistory({
        open,
        onClose: vi.fn(),
        historyKey: 'testOverlay',
      }),
      { initialProps: { open: true } },
    );

    rerender({ open: false });

    expect(backSpy).toHaveBeenCalledTimes(1);
    backSpy.mockRestore();
  });
});
