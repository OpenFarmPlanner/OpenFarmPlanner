import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Suppliers from '../pages/Suppliers';
import { CONTEXT_MENU_HINT_STORAGE_KEY } from '../components/data-grid/useContextMenuHint';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  deleteUsage: vi.fn(),
  unlinkAndDelete: vi.fn(),
  restoreUnlinkedDelete: vi.fn(),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    supplierAPI: {
      ...actual.supplierAPI,
      list: mocks.list,
      create: mocks.create,
      update: mocks.update,
      delete: mocks.delete,
      deleteUsage: mocks.deleteUsage,
      unlinkAndDelete: mocks.unlinkAndDelete,
      restoreUnlinkedDelete: mocks.restoreUnlinkedDelete,
    },
  };
});

vi.mock('../hooks/useProjectRequirement', () => ({
  useProjectRequirement: () => ({ shouldShowProjectRequiredState: false, missingProjectReason: null }),
}));

vi.mock('../commands/useCommandContext', () => ({
  useRegisterCreateActions: vi.fn(),
}));

describe('Suppliers page empty and table states', () => {
  beforeEach(() => {
    mocks.list.mockReset();
    mocks.create.mockReset();
    mocks.update.mockReset();
    mocks.delete.mockReset();
    mocks.deleteUsage.mockReset();
    mocks.unlinkAndDelete.mockReset();
    mocks.restoreUnlinkedDelete.mockReset();
    window.localStorage.clear();
  });

  it('does not show the empty state while suppliers are still loading', async () => {
    let resolveList: (value: { data: { results: Array<{ id: number; name: string; homepage_url: string }> } }) => void = () => {};
    mocks.list.mockReturnValue(new Promise<{ data: { results: Array<{ id: number; name: string; homepage_url: string }> } }>((resolve) => {
      resolveList = resolve;
    }));

    render(
      <MemoryRouter>
        <Suppliers />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Noch keine Lieferanten vorhanden')).not.toBeInTheDocument();
    expect(screen.queryByText('Name')).not.toBeInTheDocument();
    await waitFor(() => expect(mocks.list).toHaveBeenCalled());

    await act(async () => {
      resolveList({ data: { results: [{ id: 1, name: 'Reinsaat', homepage_url: 'https://example.com' }] } });
    });

    await waitFor(() => expect(screen.getByText('Reinsaat')).toBeInTheDocument());
    expect(screen.queryByText('Noch keine Lieferanten vorhanden')).not.toBeInTheDocument();
  });

  it('shows only empty-state and no table headers when no suppliers exist', async () => {
    mocks.list.mockResolvedValue({ data: { results: [] } });

    render(
      <MemoryRouter>
        <Suppliers />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Noch keine Lieferanten vorhanden')).toBeInTheDocument());
    expect(screen.queryByText('Name')).not.toBeInTheDocument();
    expect(screen.queryByText('Webseite')).not.toBeInTheDocument();
    expect(screen.queryByText('Aktionen')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Lieferant hinzufügen' })).toBeInTheDocument();
  });

  it('shows table headers when suppliers exist', async () => {
    mocks.list.mockResolvedValue({
      data: {
        results: [{ id: 1, name: 'Reinsaat', homepage_url: 'https://example.com' }],
      },
    });

    render(
      <MemoryRouter>
        <Suppliers />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Reinsaat')).toBeInTheDocument());
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Webseite')).toBeInTheDocument();
  });

  it('opens supplier row actions from the right-click context menu', async () => {
    mocks.list.mockResolvedValue({
      data: {
        results: [{ id: 1, name: 'Reinsaat', homepage_url: 'https://example.com' }],
      },
    });

    render(
      <MemoryRouter>
        <Suppliers />
      </MemoryRouter>,
    );

    const supplierName = await screen.findByText('Reinsaat');
    const supplierRow = supplierName.closest('tr');
    expect(supplierRow).not.toBeNull();

    const contextMenuEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    const stopPropagationSpy = vi.spyOn(contextMenuEvent, 'stopPropagation');
    fireEvent(supplierRow as HTMLTableRowElement, contextMenuEvent);

    expect(screen.getByRole('menuitem', { name: 'Bearbeiten' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Löschen' })).toBeInTheDocument();
    expect(contextMenuEvent.defaultPrevented).toBe(true);
    expect(stopPropagationSpy).toHaveBeenCalled();
  });

  it('opens edit dialog on single click on a supplier row', async () => {
    mocks.list.mockResolvedValue({
      data: {
        results: [{ id: 1, name: 'Reinsaat', homepage_url: 'https://example.com' }],
      },
    });

    render(
      <MemoryRouter>
        <Suppliers />
      </MemoryRouter>,
    );

    const supplierName = await screen.findByText('Reinsaat');
    fireEvent.click(supplierName.closest('tr') as HTMLTableRowElement);

    expect(await screen.findByRole('heading', { name: 'Lieferant bearbeiten' })).toBeInTheDocument();
  });

  it('opens supplier row actions from a touch long-press', async () => {
    mocks.list.mockResolvedValue({
      data: {
        results: [{ id: 1, name: 'Reinsaat', homepage_url: 'https://example.com' }],
      },
    });

    render(
      <MemoryRouter>
        <Suppliers />
      </MemoryRouter>,
    );

    const supplierName = await screen.findByText('Reinsaat');
    const supplierRow = supplierName.closest('tr') as HTMLTableRowElement;

    vi.useFakeTimers();
    try {
      fireEvent.touchStart(supplierRow, { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
      act(() => {
        vi.advanceTimersByTime(600);
      });
    } finally {
      vi.useRealTimers();
    }

    expect(screen.getByRole('menuitem', { name: 'Bearbeiten' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Löschen' })).toBeInTheDocument();
  });

  it('selecting an action from a touch-opened context menu still works', async () => {
    mocks.list.mockResolvedValue({
      data: {
        results: [{ id: 1, name: 'Reinsaat', homepage_url: 'https://example.com' }],
      },
    });

    render(
      <MemoryRouter>
        <Suppliers />
      </MemoryRouter>,
    );

    const supplierName = await screen.findByText('Reinsaat');
    const supplierRow = supplierName.closest('tr') as HTMLTableRowElement;

    vi.useFakeTimers();
    try {
      fireEvent.touchStart(supplierRow, { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
      act(() => {
        vi.advanceTimersByTime(600);
      });
    } finally {
      vi.useRealTimers();
    }

    fireEvent.click(screen.getByRole('menuitem', { name: 'Bearbeiten' }));

    expect(await screen.findByRole('heading', { name: 'Lieferant bearbeiten' })).toBeInTheDocument();
  });

  it('a tap outside the open context menu (on another row) only closes it, and does not start editing that row', async () => {
    mocks.list.mockResolvedValue({
      data: {
        results: [
          { id: 1, name: 'Reinsaat', homepage_url: 'https://example.com' },
          { id: 2, name: 'Bingenheimer Saatgut', homepage_url: 'https://example.org' },
        ],
      },
    });

    render(
      <MemoryRouter>
        <Suppliers />
      </MemoryRouter>,
    );

    const firstRow = (await screen.findByText('Reinsaat')).closest('tr') as HTMLTableRowElement;
    const secondRow = screen.getByText('Bingenheimer Saatgut').closest('tr') as HTMLTableRowElement;

    vi.useFakeTimers();
    try {
      fireEvent.touchStart(firstRow, { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
      act(() => {
        vi.advanceTimersByTime(600);
      });
    } finally {
      vi.useRealTimers();
    }
    expect(screen.getByRole('menuitem', { name: 'Bearbeiten' })).toBeInTheDocument();

    // A tap that lands outside the menu, on a *different* row, must only
    // dismiss the menu — not also start editing that row.
    const outsideTap = new TouchEvent('touchstart', {
      bubbles: true,
      cancelable: true,
      touches: [{ identifier: 2, clientX: 10, clientY: 200 }] as unknown as Touch[],
    });
    fireEvent(secondRow, outsideTap);

    expect(screen.queryByRole('menuitem', { name: 'Bearbeiten' })).not.toBeInTheDocument();
    expect(outsideTap.defaultPrevented).toBe(true);
    expect(screen.queryByRole('heading', { name: 'Lieferant bearbeiten' })).not.toBeInTheDocument();

    // A further, separate tap on that same row now behaves completely
    // normally — the menu is closed, so nothing intercepts it.
    fireEvent.click(secondRow);

    expect(await screen.findByRole('heading', { name: 'Lieferant bearbeiten' })).toBeInTheDocument();
  });

  it('suppresses the trailing click after a long press, so the edit dialog does not also open', async () => {
    mocks.list.mockResolvedValue({
      data: {
        results: [{ id: 1, name: 'Reinsaat', homepage_url: 'https://example.com' }],
      },
    });

    render(
      <MemoryRouter>
        <Suppliers />
      </MemoryRouter>,
    );

    const supplierName = await screen.findByText('Reinsaat');
    const supplierRow = supplierName.closest('tr') as HTMLTableRowElement;

    let touchEndEvent: TouchEvent;
    vi.useFakeTimers();
    try {
      fireEvent.touchStart(supplierRow, { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
      act(() => {
        vi.advanceTimersByTime(600);
      });
      // A real browser would synthesize a trailing click from this touchend
      // unless its default is prevented — jsdom doesn't perform that
      // synthesis itself, so the touchend's defaultPrevented flag is the
      // testable proxy for "the click will be suppressed".
      touchEndEvent = new TouchEvent('touchend', { bubbles: true, cancelable: true });
      fireEvent(supplierRow, touchEndEvent);
    } finally {
      vi.useRealTimers();
    }

    expect(touchEndEvent!.defaultPrevented).toBe(true);
    expect(screen.getByRole('menuitem', { name: 'Bearbeiten' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Lieferant bearbeiten' })).not.toBeInTheDocument();
  });

  it('does not open the edit dialog when tapping the website link (interactive elements keep their own action)', async () => {
    mocks.list.mockResolvedValue({
      data: {
        results: [{ id: 1, name: 'Reinsaat', homepage_url: 'https://example.com' }],
      },
    });

    render(
      <MemoryRouter>
        <Suppliers />
      </MemoryRouter>,
    );

    const websiteLink = await screen.findByRole('link', { name: 'https://example.com' });
    fireEvent.click(websiteLink);

    expect(screen.queryByRole('heading', { name: 'Lieferant bearbeiten' })).not.toBeInTheDocument();
  });

  it('shows the touch hint instead of the desktop hint on a coarse-pointer device, and persists (but does not immediately hide) the dismissal after a successful long press', async () => {
    const originalMatchMedia = window.matchMedia;
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

    try {
      mocks.list.mockResolvedValue({
        data: {
          results: [{ id: 1, name: 'Reinsaat', homepage_url: 'https://example.com' }],
        },
      });

      const { unmount } = render(
        <MemoryRouter>
          <Suppliers />
        </MemoryRouter>,
      );

      const supplierName = await screen.findByText('Reinsaat');
      expect(await screen.findByText('Tipp: Zeile länger gedrückt halten für weitere Aktionen.')).toBeInTheDocument();
      expect(screen.queryByText('Tipp: Rechtsklick auf eine Tabellenzeile öffnet weitere Aktionen.')).not.toBeInTheDocument();

      const supplierRow = supplierName.closest('tr') as HTMLTableRowElement;
      vi.useFakeTimers();
      try {
        fireEvent.touchStart(supplierRow, { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
        act(() => {
          vi.advanceTimersByTime(600);
        });
      } finally {
        vi.useRealTimers();
      }

      // Matches the existing desktop hint's contract: a successful
      // interaction persists the dismissal but does not hide the banner in
      // the current session — the menu it opened already covers it.
      expect(window.localStorage.getItem(`${CONTEXT_MENU_HINT_STORAGE_KEY}:context:suppliers:touch`)).toBe('1');
      expect(screen.getByText('Tipp: Zeile länger gedrückt halten für weitere Aktionen.')).toBeInTheDocument();

      unmount();
      mocks.list.mockResolvedValue({
        data: {
          results: [{ id: 1, name: 'Reinsaat', homepage_url: 'https://example.com' }],
        },
      });
      render(
        <MemoryRouter>
          <Suppliers />
        </MemoryRouter>,
      );

      await screen.findByText('Reinsaat');
      expect(screen.queryByText('Tipp: Zeile länger gedrückt halten für weitere Aktionen.')).not.toBeInTheDocument();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it('opens supplier row actions from the keyboard context menu command', async () => {
    mocks.list.mockResolvedValue({
      data: {
        results: [{ id: 1, name: 'Reinsaat', homepage_url: 'https://example.com' }],
      },
    });

    render(
      <MemoryRouter>
        <Suppliers />
      </MemoryRouter>,
    );

    const supplierName = await screen.findByText('Reinsaat');
    const supplierRow = supplierName.closest('tr');
    expect(supplierRow).not.toBeNull();

    fireEvent.keyDown(supplierRow as HTMLTableRowElement, { key: 'F10', shiftKey: true });

    expect(screen.getByRole('menuitem', { name: 'Bearbeiten' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Löschen' })).toBeInTheDocument();
  });

  it('deletes an unused supplier with undo feedback without a native browser confirm', async () => {
    mocks.list.mockResolvedValue({
      data: {
        results: [{ id: 1, name: 'Reinsaat', homepage_url: 'https://example.com' }],
      },
    });
    mocks.deleteUsage.mockResolvedValue({
      data: {
        can_delete: true,
        culture_count: 0,
        seed_demand_culture_count: 0,
        supplier_data_culture_count: 0,
        supplier_data_count: 0,
        total_culture_count: 0,
        culture_ids: [],
      },
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <MemoryRouter>
        <Suppliers />
      </MemoryRouter>,
    );

    await screen.findByText('Reinsaat');
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    await waitFor(() => expect(mocks.deleteUsage).toHaveBeenCalledWith(1));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.queryByText('Reinsaat')).not.toBeInTheDocument();
    expect(screen.getByText('Lieferant gelöscht.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rückgängig: Lieferant gelöscht.' })).toBeInTheDocument();

    confirmSpy.mockRestore();
  });

  it('blocks supplier deletion when existing cultures still use it', async () => {
    mocks.list.mockResolvedValue({
      data: {
        results: [{ id: 1, name: 'Reinsaat', homepage_url: 'https://example.com' }],
      },
    });
    mocks.deleteUsage.mockResolvedValue({
      data: {
        can_delete: false,
        culture_count: 12,
        seed_demand_culture_count: 2,
        supplier_data_culture_count: 5,
        supplier_data_count: 7,
        total_culture_count: 12,
        culture_ids: [1, 2, 3],
      },
    });

    render(
      <MemoryRouter>
        <Suppliers />
      </MemoryRouter>,
    );

    await screen.findByText('Reinsaat');
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    expect(await screen.findByRole('heading', { name: 'Lieferant wird noch verwendet' })).toBeInTheDocument();
    expect(screen.getByText('Dieser Lieferant wird noch von 12 Kulturen verwendet.')).toBeInTheDocument();
    expect(screen.getByText('12 Kulturen nutzen diesen Lieferanten direkt.')).toBeInTheDocument();
    expect(screen.getByText('Beim Fortfahren bleiben alle Kulturen erhalten. Lediglich die Lieferantenzuordnung wird entfernt.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zu betroffenen Kulturen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lieferant aus allen Kulturen entfernen und löschen' })).toBeInTheDocument();
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(screen.getAllByText('Reinsaat').length).toBeGreaterThan(0);
  });

  it('unlinks a used supplier from cultures, deletes it, and offers undo', async () => {
    const undoPayload = {
      supplier: {
        id: 1,
        name: 'Reinsaat',
        homepage_url: 'https://example.com',
        slug: 'reinsaat',
        allowed_domains: ['example.com'],
      },
      culture_ids: [1, 2],
      seed_demand_culture_ids: [2],
      supplier_data: [],
    };
    mocks.list.mockResolvedValue({
      data: {
        results: [{ id: 1, name: 'Reinsaat', homepage_url: 'https://example.com' }],
      },
    });
    mocks.deleteUsage.mockResolvedValue({
      data: {
        can_delete: false,
        culture_count: 2,
        seed_demand_culture_count: 1,
        supplier_data_culture_count: 0,
        supplier_data_count: 0,
        total_culture_count: 2,
        culture_ids: [1, 2],
      },
    });
    mocks.unlinkAndDelete.mockResolvedValue({
      data: {
        affected_culture_count: 2,
        undo_payload: undoPayload,
      },
    });
    mocks.restoreUnlinkedDelete.mockResolvedValue({
      data: {
        supplier: { id: 1, name: 'Reinsaat', homepage_url: 'https://example.com', allowed_domains: [] },
        restored_culture_count: 2,
        restored_supplier_data_count: 0,
      },
    });

    render(
      <MemoryRouter>
        <Suppliers />
      </MemoryRouter>,
    );

    await screen.findByText('Reinsaat');
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Lieferant aus allen Kulturen entfernen und löschen' }));

    await waitFor(() => expect(mocks.unlinkAndDelete).toHaveBeenCalledWith(1));
    expect(screen.queryByText('Reinsaat')).not.toBeInTheDocument();
    expect(screen.getByText('Lieferant gelöscht. Bei 2 Kulturen wurde die Lieferantenzuordnung entfernt.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Rückgängig: Lieferant gelöscht. Bei 2 Kulturen wurde die Lieferantenzuordnung entfernt.' }));

    await waitFor(() => expect(mocks.restoreUnlinkedDelete).toHaveBeenCalledWith(undoPayload));
  });

  it('shows backend supplier name errors under the name field', async () => {
    mocks.list.mockResolvedValue({ data: { results: [] } });
    mocks.create.mockRejectedValue({
      isAxiosError: true,
      response: {
        data: {
          name: ['Ein Lieferant mit diesem Namen existiert bereits.'],
        },
      },
    });

    render(
      <MemoryRouter initialEntries={['/app/suppliers?create=true']}>
        <Suppliers />
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Reinsaat' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(await screen.findByText('Ein Lieferant mit diesem Namen existiert bereits.')).toBeInTheDocument();
    expect(screen.queryByText('Lieferant konnte nicht gespeichert werden.')).not.toBeInTheDocument();
  });
});
