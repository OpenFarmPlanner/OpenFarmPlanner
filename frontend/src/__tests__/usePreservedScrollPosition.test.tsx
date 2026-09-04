import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { usePreservedScrollPosition } from '../hooks/usePreservedScrollPosition';

// jsdom has no layout, so a scrollable container needs stubbed metrics: the
// hook reads scrollHeight/clientHeight to clamp the offset it restores, and
// the browser clamps scrollTop assignments the same way.
const CLIENT_HEIGHT = 200;
const scrollTops = new WeakMap<Element, number>();
let scrollHeight = 1000;

const originalScrollTop = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
const originalScrollHeight = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollHeight');
const originalClientHeight = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight');

Object.defineProperty(Element.prototype, 'scrollTop', {
  configurable: true,
  get(this: Element) {
    return scrollTops.get(this) ?? 0;
  },
  set(this: Element, value: number) {
    scrollTops.set(this, Math.max(0, Math.min(value, scrollHeight - CLIENT_HEIGHT)));
  },
});
Object.defineProperty(Element.prototype, 'scrollHeight', {
  configurable: true,
  get: () => scrollHeight,
});
Object.defineProperty(Element.prototype, 'clientHeight', {
  configurable: true,
  get: () => CLIENT_HEIGHT,
});

function restoreDescriptors(): void {
  if (originalScrollTop) {
    Object.defineProperty(Element.prototype, 'scrollTop', originalScrollTop);
  }
  if (originalScrollHeight) {
    Object.defineProperty(Element.prototype, 'scrollHeight', originalScrollHeight);
  }
  if (originalClientHeight) {
    Object.defineProperty(Element.prototype, 'clientHeight', originalClientHeight);
  }
}

function ScrollableList({ isLoading }: { isLoading: boolean }): ReactElement {
  const { scrollableRef, onScroll } = usePreservedScrollPosition<HTMLUListElement>();

  if (isLoading) {
    return <p>loading</p>;
  }

  return (
    <ul data-testid="list" ref={scrollableRef} onScroll={onScroll}>
      <li>row</li>
    </ul>
  );
}

describe('usePreservedScrollPosition', () => {
  afterEach(() => {
    scrollHeight = 1000;
  });

  afterAll(restoreDescriptors);

  it('restores the last scroll offset when the container is remounted', () => {
    const { rerender } = render(<ScrollableList isLoading={false} />);

    const list = screen.getByTestId('list');
    list.scrollTop = 420;
    fireEvent.scroll(list);

    rerender(<ScrollableList isLoading />);
    rerender(<ScrollableList isLoading={false} />);

    expect(screen.getByTestId('list')).not.toBe(list);
    expect(screen.getByTestId('list').scrollTop).toBe(420);
  });

  it('clamps the restored offset to the new content height when the list shrank', () => {
    const { rerender } = render(<ScrollableList isLoading={false} />);

    const list = screen.getByTestId('list');
    list.scrollTop = 800;
    fireEvent.scroll(list);

    scrollHeight = 500;
    rerender(<ScrollableList isLoading />);
    rerender(<ScrollableList isLoading={false} />);

    expect(screen.getByTestId('list').scrollTop).toBe(300);
  });

  it('leaves a freshly mounted container at the top', () => {
    render(<ScrollableList isLoading={false} />);

    expect(screen.getByTestId('list').scrollTop).toBe(0);
  });
});
