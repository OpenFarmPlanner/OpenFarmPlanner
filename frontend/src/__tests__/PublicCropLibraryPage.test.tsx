import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublicCropLibraryPage from '../crops/pages/PublicCropLibraryPage';
import type { PublicCulture } from '../api/types';
import { CommandProvider } from '../commands/CommandProvider';
import { FocusManagerProvider } from '../focus/FocusManager';

const publicCultureApiMocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  comments: vi.fn(),
  versions: vi.fn(),
  importToProject: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      email: 'test@example.com',
      display_name: 'Test User',
      display_label: 'Test User',
      public_display_name: 'Test User',
      is_active: true,
      default_project_id: 1,
      last_project_id: 1,
      resolved_project_id: 1,
      needs_project_selection: false,
      memberships: [],
      account_pending_deletion: false,
      scheduled_deletion_at: null,
      pending_consents: [],
      public_library_terms_accepted: true,
      is_guest_demo: false,
      guest_demo_session_id: null,
      has_password: true,
    },
  }),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    publicCultureAPI: {
      ...actual.publicCultureAPI,
      list: publicCultureApiMocks.list,
      get: publicCultureApiMocks.get,
      comments: publicCultureApiMocks.comments,
      versions: publicCultureApiMocks.versions,
      importToProject: publicCultureApiMocks.importToProject,
      update: publicCultureApiMocks.update,
    },
  };
});

const publicCultures: PublicCulture[] = [
  {
    id: 1,
    status: 'published',
    name: 'Tomate',
    variety: 'Roma',
    crop_species_name: 'Tomate',
    growth_duration_days: 70,
    harvest_duration_days: 28,
    display_color: '#7cb342',
    version: 1,
  },
  {
    id: 2,
    status: 'published',
    name: 'Salat',
    variety: 'Maikönig',
    crop_species_name: 'Salat',
    growth_duration_days: 45,
    harvest_duration_days: 10,
    version: 1,
  },
];

function renderPage(): ReturnType<typeof render> {
  return render(
    <FocusManagerProvider>
      <CommandProvider>
        <MemoryRouter initialEntries={['/app/crop-library']}>
          <Routes>
            <Route path="/app/crop-library" element={<PublicCropLibraryPage />} />
          </Routes>
        </MemoryRouter>
      </CommandProvider>
    </FocusManagerProvider>,
  );
}

describe('PublicCropLibraryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    publicCultureApiMocks.list.mockResolvedValue({ data: { results: publicCultures } });
    publicCultureApiMocks.comments.mockResolvedValue({ data: [] });
    publicCultureApiMocks.versions.mockResolvedValue({ data: [] });
    publicCultureApiMocks.update.mockResolvedValue({
      data: {
        ...publicCultures[0],
        growth_duration_days: 48,
        display_color: '#123456',
        version: 2,
      },
    });
  });

  it('shows a compact, single-surface empty state before any culture is selected', async () => {
    publicCultureApiMocks.list.mockResolvedValue({ data: { results: [] } });
    renderPage();

    await screen.findByText('Keine öffentlichen Kulturen gefunden.');

    // Regression guard for a layout bug where the empty state's intro used
    // a separate grey header block (bgcolor + border-bottom) on top of the
    // three feature blocks, with a large forced min-height creating a big
    // empty gap below them. The intro and the three blocks should now sit
    // in one unified surface with a short subtitle.
    expect(screen.getByRole('heading', { name: 'Die Kulturbibliothek wächst mit der Community' })).toBeInTheDocument();
    expect(screen.getByText('Teile deine bewährten Kulturen mit anderen.')).toBeInTheDocument();
    expect(screen.queryByText(/Jede veröffentlichte Kultur erweitert die gemeinsame Kulturbibliothek/)).not.toBeInTheDocument();

    expect(screen.getByText('Entdecken')).toBeInTheDocument();
    expect(screen.getByText('Übernehmen')).toBeInTheDocument();
    expect(screen.getByText('Verbessern')).toBeInTheDocument();
    expect(screen.getByText(/Spätere Änderungen der öffentlichen Kultur wirken sich nicht auf bereits importierte Projektkulturen aus/)).toBeInTheDocument();
  });

  it('uses the shared culture list keyboard navigation on the full public library page', async () => {
    const user = userEvent.setup();
    renderPage();

    const tomatoOption = await screen.findByRole('option', { name: /Tomate/ });
    tomatoOption.focus();

    await user.keyboard('{ArrowDown}');

    expect(screen.getByRole('heading', { level: 2, name: 'Salat' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Salat/ })).toHaveFocus();
    });

    await user.keyboard('{ArrowUp}');

    expect(screen.getByRole('heading', { level: 2, name: 'Tomate' })).toBeInTheDocument();
  });

  it('edits public cultures with the shared culture form and public-library save shortcut', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('option', { name: /Tomate/ }));
    await screen.findByRole('heading', { level: 2, name: 'Tomate' });
    await user.click(screen.getByRole('button', { name: 'Bearbeiten' }));

    const editDialog = await screen.findByRole('dialog', { name: 'Öffentliche Kultur bearbeiten' });
    expect(editDialog).toHaveTextContent('Allgemeine Informationen');
    expect(editDialog).toHaveTextContent('Öffentliche Identität');
    expect(editDialog).toHaveTextContent('Tomate · Roma');
    expect(editDialog).toHaveTextContent('#7CB342');
    expect(editDialog).not.toHaveTextContent('Kulturspezifische Lieferantendaten');
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Sorte')).not.toBeInTheDocument();

    const growthInput = screen.getByLabelText('Wachstumszeit (Tage)');
    const colorInput = within(editDialog).getByLabelText('Anzeigefarbe');
    fireEvent.change(growthInput, { target: { value: '48' } });
    fireEvent.change(colorInput, { target: { value: '#123456' } });
    growthInput.focus();
    fireEvent.keyDown(window, {
      bubbles: true,
      cancelable: true,
      ctrlKey: true,
      key: 's',
    });

    await waitFor(() => expect(publicCultureApiMocks.update).toHaveBeenCalledTimes(1));
    expect(publicCultureApiMocks.update).toHaveBeenCalledWith(1, expect.objectContaining({
      base_version: 1,
      growth_duration_days: 48,
      display_color: '#123456',
      row_spacing_m: null,
    }));
    expect(publicCultureApiMocks.update.mock.calls[0][1]).not.toHaveProperty('name');
    expect(publicCultureApiMocks.update.mock.calls[0][1]).not.toHaveProperty('variety');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Öffentliche Kultur bearbeiten' })).not.toBeInTheDocument());
  }, 30000);

  it('supports the same keyboard shortcuts as the project culture list (Alt+E, Alt+I, Alt+Shift+arrows)', async () => {
    publicCultureApiMocks.importToProject.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('option', { name: /Tomate/ }));
    await screen.findByRole('heading', { level: 2, name: 'Tomate' });
    (document.activeElement as HTMLElement | null)?.blur();

    await user.keyboard('{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}');
    expect(await screen.findByRole('heading', { level: 2, name: 'Salat' })).toBeInTheDocument();

    await user.keyboard('{Alt>}{Shift>}{ArrowLeft}{/Shift}{/Alt}');
    expect(await screen.findByRole('heading', { level: 2, name: 'Tomate' })).toBeInTheDocument();

    await user.keyboard('{Alt>}e{/Alt}');
    expect(await screen.findByRole('dialog', { name: 'Öffentliche Kultur bearbeiten' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Öffentliche Kultur bearbeiten' })).not.toBeInTheDocument());

    await user.keyboard('{Alt>}i{/Alt}');
    await waitFor(() => expect(publicCultureApiMocks.importToProject).toHaveBeenCalledWith(1));
  });
});
