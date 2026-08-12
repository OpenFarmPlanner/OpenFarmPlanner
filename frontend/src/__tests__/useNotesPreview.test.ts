import { act, renderHook } from '@testing-library/react';
import { registerOpenContextMenu } from '../components/contextMenu/contextMenuOpenState';
import { useNotesPreview } from '../components/data-grid/useNotesPreview';

describe('useNotesPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens after a short delay in hover mode', () => {
    const { result } = renderHook(() => useNotesPreview());
    const anchor = document.createElement('div');

    act(() => {
      result.current.openPreview(anchor, 1, 'notes', 'hover');
    });
    expect(result.current.state).toBeNull();

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current.state).toEqual({ anchorEl: anchor, rowId: 1, field: 'notes' });
  });

  it('opens immediately in immediate mode', () => {
    const { result } = renderHook(() => useNotesPreview());
    const anchor = document.createElement('div');

    act(() => {
      result.current.openPreview(anchor, 2, 'notes', 'immediate');
    });

    expect(result.current.state).toEqual({ anchorEl: anchor, rowId: 2, field: 'notes' });
  });

  it('cancels a pending hover-open if the pointer leaves before the delay elapses', () => {
    const { result } = renderHook(() => useNotesPreview());
    const anchor = document.createElement('div');

    act(() => {
      result.current.openPreview(anchor, 3, 'notes', 'hover');
      result.current.scheduleClose();
      vi.advanceTimersByTime(500);
    });

    expect(result.current.state).toBeNull();
  });

  it('closes after a delay, and cancelScheduledClose keeps it open', () => {
    const { result } = renderHook(() => useNotesPreview());
    const anchor = document.createElement('div');

    act(() => {
      result.current.openPreview(anchor, 4, 'notes', 'immediate');
    });
    expect(result.current.state).not.toBeNull();

    act(() => {
      result.current.scheduleClose();
      result.current.cancelScheduledClose();
      vi.advanceTimersByTime(500);
    });
    expect(result.current.state).not.toBeNull();

    act(() => {
      result.current.scheduleClose();
      vi.advanceTimersByTime(500);
    });
    expect(result.current.state).toBeNull();
  });

  describe('while a context menu is open', () => {
    let release: (() => void) | null = null;

    afterEach(() => {
      release?.();
      release = null;
    });

    it('closes an open preview as soon as a context menu opens', () => {
      const { result } = renderHook(() => useNotesPreview());
      const anchor = document.createElement('div');

      act(() => {
        result.current.openPreview(anchor, 6, 'notes', 'immediate');
      });
      expect(result.current.state).not.toBeNull();

      act(() => {
        release = registerOpenContextMenu(Symbol('menu'));
      });

      expect(result.current.state).toBeNull();
    });

    it('never opens a preview whose hover delay elapses while the menu is open', () => {
      const { result } = renderHook(() => useNotesPreview());
      const anchor = document.createElement('div');

      act(() => {
        result.current.openPreview(anchor, 7, 'notes', 'hover');
        release = registerOpenContextMenu(Symbol('menu'));
        vi.advanceTimersByTime(500);
      });

      expect(result.current.state).toBeNull();
    });

    it('does not open a new preview and works again after the menu closes', () => {
      const { result } = renderHook(() => useNotesPreview());
      const anchor = document.createElement('div');
      release = registerOpenContextMenu(Symbol('menu'));

      act(() => {
        result.current.openPreview(anchor, 8, 'notes', 'immediate');
      });
      expect(result.current.state).toBeNull();

      act(() => {
        release?.();
        release = null;
        result.current.openPreview(anchor, 8, 'notes', 'immediate');
      });
      expect(result.current.state).toEqual({ anchorEl: anchor, rowId: 8, field: 'notes' });
    });
  });

  it('close() closes immediately regardless of pending timers', () => {
    const { result } = renderHook(() => useNotesPreview());
    const anchor = document.createElement('div');

    act(() => {
      result.current.openPreview(anchor, 5, 'notes', 'immediate');
      result.current.close();
    });

    expect(result.current.state).toBeNull();
  });
});
