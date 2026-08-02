/**
 * Tooltips must never cover an open context menu. The suppression lives in
 * one place (components/contextMenu/contextMenuOpenState.ts + AppTooltip), so
 * these tests exercise that central logic plus a few representative menus
 * that report into it.
 *
 * Queries here deliberately go through `data-testid` and raw DOM lookups:
 * MUI's Tooltip puts its title on the child as `aria-label`, and an open
 * `CustomContextMenu` marks everything outside the menu `aria-hidden`, so
 * role/name queries would silently stop matching once a menu is open.
 */

import { useCallback } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Button } from '@mui/material';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppTooltip } from '../components/AppTooltip';
import { ContextMenuIndicator } from '../components/contextMenu/ContextMenuIndicator';
import { CustomContextMenu } from '../components/contextMenu/CustomContextMenu';
import {
  isAnyContextMenuOpen,
  registerOpenContextMenu,
  useContextMenuOpenRegistration,
} from '../components/contextMenu/contextMenuOpenState';
import { useContextMenuPositionState } from '../components/contextMenu/useContextMenuPositionState';
import { useRowContextMenuState } from '../components/contextMenu/useRowContextMenuState';
import { FullCellTooltip } from '../components/data-grid/FullCellTooltip';

const never = (): boolean => false;

const visibleTooltip = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('.MuiTooltip-tooltip');

const openMenuElement = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('.ofp-custom-context-menu');

/** Minimal stand-in for a page: a tooltip trigger plus a context menu. */
function TooltipWithContextMenu({
  enterDelay,
  useRowMenu = false,
}: {
  enterDelay?: number;
  useRowMenu?: boolean;
}) {
  const isContextMenuTarget = useCallback((target: EventTarget | null): boolean => (
    target instanceof Element && target.closest('[data-menu-target]') !== null
  ), []);

  const positionMenu = useContextMenuPositionState<string>({ isContextMenuTarget });
  const rowMenu = useRowContextMenuState<string>({ isContextMenuTarget });
  const menu = useRowMenu ? rowMenu : positionMenu;

  return (
    <div data-menu-target="row">
      {/* enterNextDelay mirrors enterDelay so the delay also applies right
          after another tooltip was shown (MUI's hysteresis window). */}
      <AppTooltip title="Hilfetext" enterDelay={enterDelay} enterNextDelay={enterDelay}>
        <Button data-testid="tooltip-trigger">Aktion</Button>
      </AppTooltip>
      <button type="button" data-testid="open-menu" onClick={() => menu.open('row', 10, 10)}>
        Menü öffnen
      </button>
      <button type="button" data-testid="close-menu" onClick={menu.close}>
        Menü schließen
      </button>
      <CustomContextMenu open={menu.state !== null} onClose={menu.close} mouseX={10} mouseY={10}>
        <span>Aktion im Menü</span>
      </CustomContextMenu>
    </div>
  );
}

const openMenu = (): void => {
  fireEvent.click(screen.getByTestId('open-menu'));
};

const closeMenu = (): void => {
  fireEvent.click(screen.getByTestId('close-menu'));
};

const trigger = (): HTMLElement => screen.getByTestId('tooltip-trigger');

const hoverTrigger = (): void => {
  fireEvent.mouseOver(trigger());
};

describe('contextMenuOpenState', () => {
  it('reports no open menu by default and ref-counts overlapping menus', () => {
    expect(isAnyContextMenuOpen()).toBe(false);

    const releaseFirst = registerOpenContextMenu(Symbol('first'));
    const releaseSecond = registerOpenContextMenu(Symbol('second'));
    expect(isAnyContextMenuOpen()).toBe(true);

    releaseFirst();
    expect(isAnyContextMenuOpen()).toBe(true);

    releaseSecond();
    expect(isAnyContextMenuOpen()).toBe(false);

    // Releasing twice must not underflow the registry.
    releaseSecond();
    expect(isAnyContextMenuOpen()).toBe(false);
  });

  it('clears its registration when the menu unmounts while still open', () => {
    function OpenMenu() {
      useContextMenuOpenRegistration(true);
      return null;
    }

    const { unmount } = render(<OpenMenu />);
    expect(isAnyContextMenuOpen()).toBe(true);

    unmount();
    expect(isAnyContextMenuOpen()).toBe(false);
  });
});

describe('AppTooltip while a context menu is open', () => {
  it('hides an already visible tooltip as soon as a context menu opens', async () => {
    render(<TooltipWithContextMenu />);

    hoverTrigger();
    await waitFor(() => {
      expect(visibleTooltip()).toHaveTextContent('Hilfetext');
    });

    openMenu();

    expect(openMenuElement()).not.toBeNull();
    await waitFor(() => {
      expect(visibleTooltip()).toBeNull();
    });
  });

  it('does not open a new tooltip while the context menu is open', async () => {
    render(<TooltipWithContextMenu />);

    openMenu();
    expect(openMenuElement()).not.toBeNull();

    hoverTrigger();

    await act(async () => {
      await Promise.resolve();
    });
    expect(visibleTooltip()).toBeNull();
  });

  it('lets tooltips work again after the context menu closes', async () => {
    render(<TooltipWithContextMenu />);

    openMenu();
    hoverTrigger();
    expect(visibleTooltip()).toBeNull();

    closeMenu();
    fireEvent.mouseLeave(trigger());
    hoverTrigger();

    await waitFor(() => {
      expect(visibleTooltip()).toHaveTextContent('Hilfetext');
    });
  });

  it('keeps a tooltip closed when its enter delay elapses only after the menu opened', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<TooltipWithContextMenu enterDelay={500} />);

      hoverTrigger();
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(visibleTooltip()).toBeNull();

      openMenu();
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(visibleTooltip()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('applies to the row context menu state machine as well', async () => {
    render(<TooltipWithContextMenu useRowMenu />);

    hoverTrigger();
    await waitFor(() => {
      expect(visibleTooltip()).not.toBeNull();
    });

    openMenu();

    await waitFor(() => {
      expect(visibleTooltip()).toBeNull();
    });
  });

  it('suppresses tooltips opened by keyboard focus, not just hover', () => {
    render(<TooltipWithContextMenu />);

    openMenu();
    fireEvent.focus(trigger());

    expect(visibleTooltip()).toBeNull();
  });

  it('suppresses tooltips opened by a touch long press', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<TooltipWithContextMenu />);

      openMenu();
      fireEvent.touchStart(trigger());
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(visibleTooltip()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('tooltip wrappers built on AppTooltip', () => {
  let release: (() => void) | null = null;

  beforeEach(() => {
    release = registerOpenContextMenu(Symbol('menu'));
  });

  afterEach(() => {
    release?.();
    release = null;
  });

  it('suppresses FullCellTooltip even while the cell keeps focus', () => {
    render(
      <FullCellTooltip title="Kein Wert verfügbar" cellHasFocus>
        <span>-</span>
      </FullCellTooltip>,
    );

    expect(visibleTooltip()).toBeNull();
  });

  it('suppresses the ContextMenuIndicator tooltip', () => {
    render(<ContextMenuIndicator label="Aktionen" onClick={vi.fn()} />);

    fireEvent.mouseOver(screen.getByRole('button', { name: 'Aktionen' }));

    expect(visibleTooltip()).toBeNull();
  });
});

describe('context menus reporting their open state', () => {
  it('reports open while a positioned chart-style menu is open', () => {
    function ChartMenu() {
      const { state, open, close } = useContextMenuPositionState<string>({ isContextMenuTarget: never });

      return (
        <>
          <button type="button" data-testid="open-menu" onClick={() => open('segment', 4, 8)}>
            Öffnen
          </button>
          <button type="button" data-testid="close-menu" onClick={close}>
            Schließen
          </button>
          <CustomContextMenu open={state !== null} onClose={close} mouseX={4} mouseY={8}>
            <span>Aktion</span>
          </CustomContextMenu>
        </>
      );
    }

    render(<ChartMenu />);
    expect(isAnyContextMenuOpen()).toBe(false);

    openMenu();
    expect(isAnyContextMenuOpen()).toBe(true);

    closeMenu();
    expect(isAnyContextMenuOpen()).toBe(false);
  });
});
