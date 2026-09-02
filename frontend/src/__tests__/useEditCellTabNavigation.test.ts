import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  forwardEditCellTabNavigation,
  useEditCellTabNavigation,
} from '../components/data-grid/useEditCellTabNavigation';

function makeReactKeyEvent(
  overrides: Partial<ReactKeyboardEvent<HTMLInputElement>>,
): ReactKeyboardEvent<HTMLInputElement> {
  return {
    key: 'Tab',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as ReactKeyboardEvent<HTMLInputElement>;
}

describe('forwardEditCellTabNavigation', () => {
  it('forwards a Tab keypress to the navigation handler', () => {
    const navigate = vi.fn(() => true);
    forwardEditCellTabNavigation(makeReactKeyEvent({ key: 'Tab' }), navigate, 5, 'area_m2');

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0][0]).toMatchObject({ id: 5, field: 'area_m2' });
  });

  it('keeps Ctrl+A local and does not navigate', () => {
    const navigate = vi.fn(() => true);
    const event = makeReactKeyEvent({ key: 'a', ctrlKey: true });

    forwardEditCellTabNavigation(event, navigate, 5, 'area_m2');

    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('ignores other keys', () => {
    const navigate = vi.fn(() => true);
    forwardEditCellTabNavigation(makeReactKeyEvent({ key: 'Enter' }), navigate, 5, 'area_m2');

    expect(navigate).not.toHaveBeenCalled();
  });

  it('is a no-op when no navigation handler is provided', () => {
    expect(() =>
      forwardEditCellTabNavigation(makeReactKeyEvent({ key: 'Tab' }), null, 5, 'area_m2'),
    ).not.toThrow();
  });
});

describe('useEditCellTabNavigation', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('forwards a native Tab keydown captured on the input', () => {
    const input = document.createElement('input');
    document.body.append(input);
    const navigate = vi.fn(() => true);

    renderHook(() => useEditCellTabNavigation({ current: input }, navigate, 7, 'plants_count'));

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0][0]).toMatchObject({ id: 7, field: 'plants_count' });
  });

  it('stops Ctrl+A locally and ignores non-Tab keys', () => {
    const input = document.createElement('input');
    document.body.append(input);
    const navigate = vi.fn(() => true);

    renderHook(() => useEditCellTabNavigation({ current: input }, navigate, 7, 'plants_count'));

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(navigate).not.toHaveBeenCalled();
  });

  it('removes the listener on unmount', () => {
    const input = document.createElement('input');
    document.body.append(input);
    const navigate = vi.fn(() => true);

    const { unmount } = renderHook(() =>
      useEditCellTabNavigation({ current: input }, navigate, 7, 'plants_count'),
    );
    unmount();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

    expect(navigate).not.toHaveBeenCalled();
  });
});
