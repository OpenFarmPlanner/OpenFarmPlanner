import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicCultureLibraryDialog } from '../crops/components/PublicCultureLibraryDialog';
import type { PublicCulture } from '../api/types';

const culture: PublicCulture = {
  id: 1,
  status: 'published',
  name: 'Tomate',
  variety: 'Roma',
  seed_supplier: 'Open Seeds',
  growth_duration_days: 70,
  harvest_duration_days: 28,
  version: 1,
};

const lettuceCulture: PublicCulture = {
  id: 2,
  status: 'published',
  name: 'Salat',
  variety: 'Maikönig',
  seed_supplier: 'Open Seeds',
  growth_duration_days: 45,
  harvest_duration_days: 10,
  version: 1,
};

const carrotCulture: PublicCulture = {
  id: 3,
  status: 'published',
  name: 'Möhre',
  variety: 'Nantaise',
  seed_supplier: 'Open Seeds',
  growth_duration_days: 90,
  harvest_duration_days: 21,
  version: 1,
};

function createMatchMedia(width: number) {
  return vi.fn().mockImplementation((query: string) => {
    const minWidth = query.match(/min-width:\s*(\d+(?:\.\d+)?)px/);
    const maxWidth = query.match(/max-width:\s*(\d+(?:\.\d+)?)px/);
    const matchesMinWidth = !minWidth || width >= Number(minWidth[1]);
    const matchesMaxWidth = !maxWidth || width <= Number(maxWidth[1]);

    return {
      matches: matchesMinWidth && matchesMaxWidth,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });
}

function mockMobileViewport(): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: createMatchMedia(390),
  });
}

function mockDesktopViewport(): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: createMatchMedia(1024),
  });
}

function renderDialog(props: Parameters<typeof PublicCultureLibraryDialog>[0]): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <PublicCultureLibraryDialog {...props} />
    </MemoryRouter>,
  );
}

describe('PublicCultureLibraryDialog', () => {
  beforeEach(() => {
    mockMobileViewport();
    window.history.replaceState({ page: 'cultures' }, '', '/app/cultures');
  });

  it('closes the mobile dialog when the browser history entry is popped', async () => {
    const onClose = vi.fn();

    renderDialog(
      {
        open: true,
        loading: false,
        error: null,
        cultures: [culture],
        importingId: null,
        onClose,
        onSearch: vi.fn(),
        onImport: vi.fn(),
      },
    );

    await waitFor(() => {
      expect(window.history.state).toMatchObject({
        openFarmPlannerPublicCultureLibrary: expect.any(String),
      });
    });

    act(() => {
      window.history.back();
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(window.location.pathname).toBe('/app/cultures');
    });
  });

  it('closes immediately when the mobile cancel button is clicked', async () => {
    function ClosableDialog() {
      const [open, setOpen] = useState(true);

      return (
        <PublicCultureLibraryDialog
          open={open}
          loading={false}
          error={null}
          cultures={[culture]}
          importingId={null}
          onClose={() => setOpen(false)}
          onSearch={vi.fn()}
          onImport={vi.fn()}
        />
      );
    }

    render(
      <MemoryRouter>
        <ClosableDialog />
      </MemoryRouter>,
    );

    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(window.location.pathname).toBe('/app/cultures');
    });
  });

  it('uses a full viewport mobile paper with an opaque background', async () => {
    renderDialog(
      {
        open: true,
        loading: false,
        error: null,
        cultures: [culture],
        importingId: null,
        onClose: vi.fn(),
        onSearch: vi.fn(),
        onImport: vi.fn(),
      },
    );

    const dialog = await screen.findByRole('dialog');
    const paper = dialog.closest('.MuiDialog-paper');

    expect(paper).toHaveClass('MuiDialog-paperFullScreen');
    expect(paper).toHaveClass('MuiDialog-paperWidthFalse');
    expect(paper).not.toHaveStyle({ backgroundColor: 'transparent' });
  });

  it('shows a community invitation in the desktop detail empty state', async () => {
    mockDesktopViewport();

    renderDialog(
      {
        open: true,
        loading: false,
        error: null,
        cultures: [culture],
        importingId: null,
        onClose: vi.fn(),
        onSearch: vi.fn(),
        onImport: vi.fn(),
      },
    );

    await screen.findByRole('dialog');

    expect(screen.getByText('Die Kulturbibliothek wächst mit der Community')).toBeInTheDocument();
    expect(screen.getByText('Teile deine bewährten Kulturen mit anderen.')).toBeInTheDocument();
    expect(screen.getByText('So geht’s:').tagName).toBe('STRONG');
    expect(screen.getByTestId('MoreVertIcon')).toBeInTheDocument();
    expect(screen.getByTestId('MoreVertIcon').closest('button')).toBeNull();
    expect(screen.getByText('Veröffentlichen').tagName).toBe('STRONG');
    expect(screen.queryByText(/⋮/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('So geht’s: Bei einer Kultur das Drei-Punkte-Menü öffnen und Veröffentlichen wählen.')).toHaveTextContent('So geht’s:Bei einer Kultur→Veröffentlichen');
    expect(screen.queryByText(/Eigene Kulturen können später direkt aus den Kulturdetails veröffentlicht werden/)).not.toBeInTheDocument();
  });

  it('presents the picker as an import dialog and imports the selected culture', async () => {
    mockDesktopViewport();
    const onImport = vi.fn();

    renderDialog(
      {
        open: true,
        loading: false,
        error: null,
        cultures: [culture],
        importingId: null,
        onClose: vi.fn(),
        onSearch: vi.fn(),
        onImport,
      },
    );

    expect(await screen.findByRole('dialog', { name: 'Aus Kulturbibliothek importieren' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kulturbibliothek öffnen' })).toHaveAttribute('href', '/app/crop-library');
    expect(screen.getByRole('button', { name: 'In Projekt importieren' })).toBeDisabled();

    fireEvent.click(screen.getByText('Tomate (Roma)'));
    fireEvent.click(screen.getByRole('button', { name: 'In Projekt importieren' }));

    expect(onImport).toHaveBeenCalledWith(culture);
  });

  it('uses localized public crop titles in the picker list and detail pane', async () => {
    mockDesktopViewport();
    const localizedCulture: PublicCulture = {
      ...culture,
      name: 'Ackerbohne',
      variety: 'Hangdown',
      display_name: 'Broad bean',
      display_language_code: 'en',
    };

    renderDialog(
      {
        open: true,
        loading: false,
        error: null,
        cultures: [localizedCulture],
        importingId: null,
        onClose: vi.fn(),
        onSearch: vi.fn(),
        onImport: vi.fn(),
      },
    );

    fireEvent.click(await screen.findByRole('option', { name: /Broad bean/ }));
    expect(screen.getByRole('heading', { level: 6, name: 'Broad bean (Hangdown)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Ackerbohne/ })).not.toBeInTheDocument();
  });

  it('supports keyboard navigation in the desktop import list', async () => {
    mockDesktopViewport();
    const user = userEvent.setup();
    const onImport = vi.fn();

    renderDialog(
      {
        open: true,
        loading: false,
        error: null,
        cultures: [culture, lettuceCulture, carrotCulture],
        importingId: null,
        onClose: vi.fn(),
        onSearch: vi.fn(),
        onImport,
      },
    );

    expect(await screen.findByRole('dialog', { name: 'Aus Kulturbibliothek importieren' })).toBeInTheDocument();

    screen.getByRole('option', { name: /Tomate/ }).focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('heading', { level: 6, name: 'Salat (Maikönig)' })).toBeInTheDocument();

    await user.keyboard('{End}');
    expect(screen.getByRole('heading', { level: 6, name: 'Möhre (Nantaise)' })).toBeInTheDocument();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('heading', { level: 6, name: 'Möhre (Nantaise)' })).toBeInTheDocument();

    await user.keyboard('{Home}');
    expect(screen.getByRole('heading', { level: 6, name: 'Tomate (Roma)' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Tomate/ })).toHaveFocus();
    });

    fireEvent.click(screen.getByRole('button', { name: 'In Projekt importieren' }));
    expect(onImport).toHaveBeenCalledWith(culture);
  });

  it('keeps list navigation scoped away from the import dialog search field', async () => {
    mockDesktopViewport();
    const user = userEvent.setup();

    renderDialog(
      {
        open: true,
        loading: false,
        error: null,
        cultures: [culture, lettuceCulture],
        importingId: null,
        onClose: vi.fn(),
        onSearch: vi.fn(),
        onImport: vi.fn(),
      },
    );

    await screen.findByRole('dialog', { name: 'Aus Kulturbibliothek importieren' });
    const searchInput = screen.getByLabelText('Öffentliche Kulturen durchsuchen');
    searchInput.focus();

    await user.keyboard('{ArrowDown}');

    expect(screen.getByText('Die Kulturbibliothek wächst mit der Community')).toBeInTheDocument();
    expect(searchInput).toHaveFocus();
  });

  it('shows the community contribution empty state on mobile when the library is empty', async () => {
    renderDialog(
      {
        open: true,
        loading: false,
        error: null,
        cultures: [],
        importingId: null,
        onClose: vi.fn(),
        onSearch: vi.fn(),
        onImport: vi.fn(),
      },
    );

    await screen.findByRole('dialog');

    expect(screen.getByText('Noch keine öffentlichen Kulturen vorhanden')).toBeInTheDocument();
    expect(screen.getByText(/Die Kulturbibliothek lebt von den Beiträgen der Community/)).toBeInTheDocument();
  });
});
