import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useContextMenuFocus } from '../components/data-grid/contextMenuFocus';

function ContextMenuHarness({ open }: { open: boolean }) {
  const menuListRef = useContextMenuFocus(open);

  if (!open) {
    return null;
  }

  return (
    <ul ref={menuListRef} role="menu">
      <li role="menuitem" tabIndex={-1} data-testid="first-item">
        Erste Aktion
      </li>
    </ul>
  );
}

describe('useContextMenuFocus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('focuses the first menu item once the menu is open', () => {
    const { getByTestId } = render(<ContextMenuHarness open />);

    vi.advanceTimersByTime(40);

    expect(getByTestId('first-item')).toHaveFocus();
  });

  it('does not run the deferred focus callbacks after unmount', () => {
    const { unmount } = render(<ContextMenuHarness open />);

    unmount();
    const pendingTimers = vi.getTimerCount();
    vi.advanceTimersByTime(40);

    expect(pendingTimers).toBe(0);
  });

  it('does not run the deferred focus callbacks after the menu closes', () => {
    const { rerender } = render(<ContextMenuHarness open />);

    rerender(<ContextMenuHarness open={false} />);

    expect(vi.getTimerCount()).toBe(0);
  });
});
