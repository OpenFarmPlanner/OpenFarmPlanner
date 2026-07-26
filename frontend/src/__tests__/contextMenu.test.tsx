import { act, fireEvent, render } from '@testing-library/react';
import { useCallback } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LONG_PRESS_THRESHOLD_MS,
  closestContextMenuElement,
  shouldOpenCustomContextMenu,
  useCloseCustomContextMenuOnNativeContextMenu,
  useLongPress,
} from '../utils/contextMenu';

function ContextMenuBoundary({
  open,
  onClose,
  onOpenMenuContextMenu,
}: {
  open: boolean;
  onClose: () => void;
  onOpenMenuContextMenu?: (event: MouseEvent) => void;
}) {
  const isCustomContextMenuTarget = useCallback((target: EventTarget | null): boolean => (
    target instanceof HTMLElement && target.closest('[data-custom-context-menu-target]') !== null
  ), []);

  useCloseCustomContextMenuOnNativeContextMenu(
    open,
    onClose,
    isCustomContextMenuTarget,
    onOpenMenuContextMenu,
  );

  return (
    <>
      <div data-testid="custom-target" data-custom-context-menu-target="true" />
      <div data-testid="native-target" />
      <div role="menu" data-testid="open-menu" />
    </>
  );
}

describe('context menu helpers', () => {
  it('keeps native context menus available for editable targets', () => {
    const input = document.createElement('input');

    expect(shouldOpenCustomContextMenu(input)).toBe(false);
  });

  it('still opens the custom context menu for a plain HTML target', () => {
    const cell = document.createElement('td');
    expect(shouldOpenCustomContextMenu(cell)).toBe(true);
  });

  it('still opens the custom context menu when the target is an SVG icon (e.g. an IconButton icon)', () => {
    // Right-clicking directly on an SVG icon inside a row (MUI's
    // <IconButton><SomeIcon /></IconButton> pattern used for every inline
    // row action) makes the native event's target an SVGElement, not an
    // HTMLElement - SVGElement is a sibling of HTMLElement under Element,
    // not a subtype of it. This is the regression that let the native
    // browser context menu leak through for icons/buttons inside table rows.
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.appendChild(path);
    expect(path instanceof HTMLElement).toBe(false);

    expect(shouldOpenCustomContextMenu(path)).toBe(true);
  });

  it('closestContextMenuElement finds an ancestor row for SVG targets, unlike a plain instanceof HTMLElement check', () => {
    const row = document.createElement('tr');
    row.setAttribute('data-id', '1');
    row.setAttribute('role', 'row');
    const button = document.createElement('button');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.appendChild(path);
    button.appendChild(svg);
    row.appendChild(button);
    document.body.appendChild(row);

    expect(closestContextMenuElement(path, '[role="row"][data-id]')).toBe(row);

    document.body.removeChild(row);
  });

  it('closestContextMenuElement returns null for non-Element targets (e.g. window, text nodes)', () => {
    expect(closestContextMenuElement(null, 'tr')).toBeNull();
    expect(closestContextMenuElement(document.createTextNode('x'), 'tr')).toBeNull();
  });

  it('does not close the custom menu when right-clicking another supported target', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<ContextMenuBoundary open onClose={onClose} />);
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });

    fireEvent(getByTestId('custom-target'), event);

    expect(event.defaultPrevented).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes the custom menu without suppressing the browser menu on unsupported targets', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<ContextMenuBoundary open onClose={onClose} />);
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });

    fireEvent(getByTestId('native-target'), event);

    expect(event.defaultPrevented).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('suppresses the browser menu and repositions when right-clicking the open custom menu itself', () => {
    const onClose = vi.fn();
    const onOpenMenuContextMenu = vi.fn();
    const { getByTestId } = render(
      <ContextMenuBoundary
        open
        onClose={onClose}
        onOpenMenuContextMenu={onOpenMenuContextMenu}
      />,
    );
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });

    fireEvent(getByTestId('open-menu'), event);

    expect(event.defaultPrevented).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(onOpenMenuContextMenu).toHaveBeenCalledTimes(1);
  });
});

function LongPressProbe({ onLongPress }: { onLongPress: () => void }) {
  const { onTouchStart, onTouchEnd, onTouchMove, isLongPressing } = useLongPress(onLongPress);

  return (
    <div
      data-testid="press-target"
      data-long-pressing={isLongPressing ? 'true' : undefined}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
    />
  );
}

describe('useLongPress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens the context menu after the touch is held past the threshold', () => {
    const onLongPress = vi.fn();
    const { getByTestId } = render(<LongPressProbe onLongPress={onLongPress} />);
    const target = getByTestId('press-target');

    fireEvent.touchStart(target, { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
    expect(target).toHaveAttribute('data-long-pressing', 'true');
    expect(onLongPress).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_THRESHOLD_MS);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('does not open the context menu on a short tap', () => {
    const onLongPress = vi.fn();
    const { getByTestId } = render(<LongPressProbe onLongPress={onLongPress} />);
    const target = getByTestId('press-target');

    fireEvent.touchStart(target, { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
    fireEvent.touchEnd(target);
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_THRESHOLD_MS);
    });

    expect(onLongPress).not.toHaveBeenCalled();
    expect(target).not.toHaveAttribute('data-long-pressing');
  });

  it('cancels the long press when the finger moves (scroll/drag)', () => {
    const onLongPress = vi.fn();
    const { getByTestId } = render(<LongPressProbe onLongPress={onLongPress} />);
    const target = getByTestId('press-target');

    fireEvent.touchStart(target, { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
    fireEvent.touchMove(target, { touches: [{ identifier: 1, clientX: 40, clientY: 40 }] });
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_THRESHOLD_MS);
    });

    expect(onLongPress).not.toHaveBeenCalled();
    expect(target).not.toHaveAttribute('data-long-pressing');
  });

  it('cancels the long press when released just before the threshold', () => {
    const onLongPress = vi.fn();
    const { getByTestId } = render(<LongPressProbe onLongPress={onLongPress} />);
    const target = getByTestId('press-target');

    fireEvent.touchStart(target, { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_THRESHOLD_MS - 50);
    });
    fireEvent.touchEnd(target);
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });
});
