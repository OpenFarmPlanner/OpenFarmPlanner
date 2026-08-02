import { act, fireEvent, render } from '@testing-library/react';
import { useCallback } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LONG_PRESS_THRESHOLD_MS,
  closestContextMenuElement,
  shouldOpenCustomContextMenu,
  useCloseCustomContextMenuOnNativeContextMenu,
  useIsCoarsePointer,
  useLongPress,
} from '../utils/contextMenu';

function ContextMenuBoundary({
  open,
  onClose,
  onOpenMenuContextMenu,
  onNativeTargetActivate,
}: {
  open: boolean;
  onClose: () => void;
  onOpenMenuContextMenu?: (event: MouseEvent) => void;
  /** Stands in for a table row/cell's own tap action (e.g. start editing). */
  onNativeTargetActivate?: () => void;
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
      <div
        data-testid="native-target"
        onClick={onNativeTargetActivate}
        onMouseDown={onNativeTargetActivate}
        onPointerDown={onNativeTargetActivate}
        onTouchStart={onNativeTargetActivate}
      />
      <div role="menu" data-testid="open-menu" />
    </>
  );
}

function createPointerEvent(type: string, init: MouseEventInit): Event {
  const PointerEventConstructor = window.PointerEvent ?? MouseEvent;
  return new PointerEventConstructor(type, init);
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

  it('a touch tap outside the menu closes it without also triggering the tapped target\'s own action', () => {
    const onClose = vi.fn();
    const onNativeTargetActivate = vi.fn();
    const { getByTestId } = render(
      <ContextMenuBoundary open onClose={onClose} onNativeTargetActivate={onNativeTargetActivate} />,
    );

    const touchStartEvent = new TouchEvent('touchstart', {
      bubbles: true,
      cancelable: true,
      touches: [],
    });
    fireEvent(getByTestId('native-target'), touchStartEvent);

    expect(onClose).toHaveBeenCalledTimes(1);
    // preventDefault() suppresses the browser's synthetic mousedown/click
    // sequence a real touch would otherwise generate from this same tap.
    expect(touchStartEvent.defaultPrevented).toBe(true);
    // stopPropagation() keeps this same touchstart from also reaching the
    // target's own handler (which a real cell would use to arm a long
    // press or start editing) — it must never fire for this closing tap.
    expect(onNativeTargetActivate).not.toHaveBeenCalled();
  });

  it('a left click outside the menu closes it without also triggering the clicked target action', () => {
    const onClose = vi.fn();
    const onNativeTargetActivate = vi.fn();
    const { getByTestId } = render(
      <ContextMenuBoundary open onClose={onClose} onNativeTargetActivate={onNativeTargetActivate} />,
    );
    const nativeTarget = getByTestId('native-target');

    const pointerDownEvent = createPointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 });
    fireEvent(nativeTarget, pointerDownEvent);
    const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 });
    fireEvent(nativeTarget, mouseDownEvent);
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    fireEvent(nativeTarget, clickEvent);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(pointerDownEvent.defaultPrevented).toBe(true);
    expect(mouseDownEvent.defaultPrevented).toBe(true);
    expect(clickEvent.defaultPrevented).toBe(true);
    expect(onNativeTargetActivate).not.toHaveBeenCalled();
  });

  it('does not intercept a touch tap that lands on the menu itself (menu actions keep working)', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<ContextMenuBoundary open onClose={onClose} />);

    const touchStartEvent = new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [] });
    fireEvent(getByTestId('open-menu'), touchStartEvent);

    expect(onClose).not.toHaveBeenCalled();
    expect(touchStartEvent.defaultPrevented).toBe(false);
  });

  it('a later, separate tap on the same target works normally once the menu is closed', () => {
    const onClose = vi.fn();
    const onNativeTargetActivate = vi.fn();
    const { getByTestId, rerender } = render(
      <ContextMenuBoundary open onClose={onClose} onNativeTargetActivate={onNativeTargetActivate} />,
    );

    fireEvent(getByTestId('native-target'), new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [] }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onNativeTargetActivate).not.toHaveBeenCalled();

    // The menu is now closed (open=false) — the dismiss-only interception
    // is torn down, so a fresh, separate tap behaves completely normally.
    rerender(
      <ContextMenuBoundary open={false} onClose={onClose} onNativeTargetActivate={onNativeTargetActivate} />,
    );
    const secondTouchStart = new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [] });
    fireEvent(getByTestId('native-target'), secondTouchStart);

    expect(onNativeTargetActivate).toHaveBeenCalledTimes(1);
    expect(secondTouchStart.defaultPrevented).toBe(false);
  });

  it('a later, separate left click on the same target works normally once the menu is closed', () => {
    const onClose = vi.fn();
    const onNativeTargetActivate = vi.fn();
    const { getByTestId, rerender } = render(
      <ContextMenuBoundary open onClose={onClose} onNativeTargetActivate={onNativeTargetActivate} />,
    );
    const nativeTarget = getByTestId('native-target');

    fireEvent(nativeTarget, createPointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
    fireEvent(nativeTarget, new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    fireEvent(nativeTarget, new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onNativeTargetActivate).not.toHaveBeenCalled();

    rerender(
      <ContextMenuBoundary open={false} onClose={onClose} onNativeTargetActivate={onNativeTargetActivate} />,
    );
    const secondClick = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    fireEvent(nativeTarget, secondClick);

    expect(onNativeTargetActivate).toHaveBeenCalledTimes(1);
    expect(secondClick.defaultPrevented).toBe(false);
  });

  it('secondary pointer events on custom menu targets do not reach normal pointer handlers before contextmenu', () => {
    const onClose = vi.fn();
    const onNativeTargetActivate = vi.fn();
    const { getByTestId } = render(
      <ContextMenuBoundary open={false} onClose={onClose} onNativeTargetActivate={onNativeTargetActivate} />,
    );
    const customTarget = getByTestId('custom-target');
    customTarget.addEventListener('mousedown', onNativeTargetActivate);
    customTarget.addEventListener('pointerdown', onNativeTargetActivate);

    const pointerDownEvent = createPointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 2 });
    fireEvent(customTarget, pointerDownEvent);
    const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 2 });
    fireEvent(customTarget, mouseDownEvent);

    expect(pointerDownEvent.defaultPrevented).toBe(false);
    expect(mouseDownEvent.defaultPrevented).toBe(false);
    expect(onNativeTargetActivate).not.toHaveBeenCalled();
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

  it('suppresses the trailing click (preventDefault on touchend) once a long press has fired', () => {
    const onLongPress = vi.fn();
    const { getByTestId } = render(<LongPressProbe onLongPress={onLongPress} />);
    const target = getByTestId('press-target');

    fireEvent.touchStart(target, { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_THRESHOLD_MS);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);

    const touchEndEvent = new TouchEvent('touchend', { bubbles: true, cancelable: true });
    fireEvent(target, touchEndEvent);

    expect(touchEndEvent.defaultPrevented).toBe(true);
  });

  it('does not suppress the trailing click on a plain short tap (no long press fired)', () => {
    const onLongPress = vi.fn();
    const { getByTestId } = render(<LongPressProbe onLongPress={onLongPress} />);
    const target = getByTestId('press-target');

    fireEvent.touchStart(target, { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });

    const touchEndEvent = new TouchEvent('touchend', { bubbles: true, cancelable: true });
    fireEvent(target, touchEndEvent);

    expect(onLongPress).not.toHaveBeenCalled();
    expect(touchEndEvent.defaultPrevented).toBe(false);
  });

  it('does not suppress the trailing click after a press was cancelled by movement', () => {
    const onLongPress = vi.fn();
    const { getByTestId } = render(<LongPressProbe onLongPress={onLongPress} />);
    const target = getByTestId('press-target');

    fireEvent.touchStart(target, { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
    fireEvent.touchMove(target, { touches: [{ identifier: 1, clientX: 40, clientY: 40 }] });
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_THRESHOLD_MS);
    });

    const touchEndEvent = new TouchEvent('touchend', { bubbles: true, cancelable: true });
    fireEvent(target, touchEndEvent);

    expect(onLongPress).not.toHaveBeenCalled();
    expect(touchEndEvent.defaultPrevented).toBe(false);
  });
});

function CoarsePointerProbe() {
  const isCoarsePointer = useIsCoarsePointer();
  return <div data-testid="coarse-pointer-probe" data-coarse={isCoarsePointer ? 'true' : 'false'} />;
}

describe('useIsCoarsePointer', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('reflects the (pointer: coarse) media query', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(pointer: coarse)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const { getByTestId } = render(<CoarsePointerProbe />);

    expect(getByTestId('coarse-pointer-probe')).toHaveAttribute('data-coarse', 'true');
  });

  it('is false when the device reports a fine pointer', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const { getByTestId } = render(<CoarsePointerProbe />);

    expect(getByTestId('coarse-pointer-probe')).toHaveAttribute('data-coarse', 'false');
  });
});
