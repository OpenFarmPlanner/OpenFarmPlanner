import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROW_LONG_PRESS_MS, useLongPressTimer } from '../components/contextMenu/useLongPressTimer';

describe('useLongPressTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses a 400ms threshold for table row long presses', () => {
    expect(ROW_LONG_PRESS_MS).toBe(400);
  });

  it('does not fire on a short tap held for less than the threshold', () => {
    const fire = vi.fn();
    const { result } = renderHook(() => useLongPressTimer(ROW_LONG_PRESS_MS));

    act(() => {
      result.current.start(fire);
      vi.advanceTimersByTime(ROW_LONG_PRESS_MS - 1);
    });

    expect(fire).not.toHaveBeenCalled();
  });

  it('fires after the configured duration', () => {
    const fire = vi.fn();
    const { result } = renderHook(() => useLongPressTimer(ROW_LONG_PRESS_MS));

    act(() => {
      result.current.start(fire);
    });
    expect(fire).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(ROW_LONG_PRESS_MS);
    });
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it('does not fire once clear() is called before the duration elapses (scroll/short tap)', () => {
    const fire = vi.fn();
    const { result } = renderHook(() => useLongPressTimer(ROW_LONG_PRESS_MS));

    act(() => {
      result.current.start(fire);
      result.current.clear();
      vi.advanceTimersByTime(ROW_LONG_PRESS_MS);
    });

    expect(fire).not.toHaveBeenCalled();
  });

  it('endTouch suppresses the trailing click (preventDefault) once the timer has fired', () => {
    const fire = vi.fn();
    const { result } = renderHook(() => useLongPressTimer(ROW_LONG_PRESS_MS));

    act(() => {
      result.current.start(fire);
      vi.advanceTimersByTime(ROW_LONG_PRESS_MS);
    });
    expect(fire).toHaveBeenCalledTimes(1);

    const preventDefault = vi.fn();
    act(() => {
      result.current.endTouch({ preventDefault });
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('endTouch does not suppress the click on a plain short tap (timer never fired)', () => {
    const fire = vi.fn();
    const { result } = renderHook(() => useLongPressTimer(ROW_LONG_PRESS_MS));

    act(() => {
      result.current.start(fire);
    });

    const preventDefault = vi.fn();
    act(() => {
      result.current.endTouch({ preventDefault });
    });

    expect(fire).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('only suppresses the click once — a second endTouch call after firing does not preventDefault again', () => {
    const fire = vi.fn();
    const { result } = renderHook(() => useLongPressTimer(ROW_LONG_PRESS_MS));

    act(() => {
      result.current.start(fire);
      vi.advanceTimersByTime(ROW_LONG_PRESS_MS);
    });

    const firstPreventDefault = vi.fn();
    const secondPreventDefault = vi.fn();
    act(() => {
      result.current.endTouch({ preventDefault: firstPreventDefault });
      result.current.endTouch({ preventDefault: secondPreventDefault });
    });

    expect(firstPreventDefault).toHaveBeenCalledTimes(1);
    expect(secondPreventDefault).not.toHaveBeenCalled();
  });
});
