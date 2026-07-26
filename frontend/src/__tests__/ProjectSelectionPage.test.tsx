import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import ProjectSelectionPage from '../pages/ProjectSelectionPage';
import { DEV_ONBOARDING_PREVIEW_STORAGE_KEY } from '../projects/devOnboardingPreview';

const projectApiMocks = vi.hoisted(() => ({
  createDemo: vi.fn(async () => ({
    data: {
      id: 9,
      name: 'Solawi Sonnenacker',
      slug: 'solawi-sonnenacker',
      description: '',
      is_active: true,
      deleted_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  })),
  listDeleted: vi.fn(async () => ({ data: [] })),
  delete: vi.fn(async () => ({ data: {} })),
  restore: vi.fn(async () => ({ data: {} })),
  permanentDelete: vi.fn(async () => ({ data: {} })),
}));

const authState = vi.hoisted(() => ({
  user: {
    memberships: [
      { project_id: 1, project_name: 'Alpha', role: 'admin' as const },
      { project_id: 2, project_name: 'Beta', role: 'member' as const },
    ],
  },
  switchActiveProject: vi.fn(async () => {}),
  refreshUser: vi.fn(async () => null),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    projectAPI: {
      ...actual.projectAPI,
      createDemo: projectApiMocks.createDemo,
      listDeleted: projectApiMocks.listDeleted,
      delete: projectApiMocks.delete,
      restore: projectApiMocks.restore,
      permanentDelete: projectApiMocks.permanentDelete,
    },
  };
});

describe('ProjectSelectionPage', () => {
  beforeEach(() => {
    localStorage.clear();
    authState.switchActiveProject.mockClear();
    authState.refreshUser.mockClear();
    projectApiMocks.createDemo.mockClear();
    projectApiMocks.delete.mockClear();
    projectApiMocks.delete.mockResolvedValue({ data: {} });
    projectApiMocks.restore.mockClear();
    projectApiMocks.restore.mockResolvedValue({ data: {} });
    projectApiMocks.permanentDelete.mockClear();
    projectApiMocks.permanentDelete.mockResolvedValue({ data: {} });
    projectApiMocks.createDemo.mockResolvedValue({
      data: {
        id: 9,
        name: 'Solawi Sonnenacker',
        slug: 'solawi-sonnenacker',
        description: '',
        is_active: true,
        deleted_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    });
    projectApiMocks.listDeleted.mockClear();
    projectApiMocks.listDeleted.mockResolvedValue({ data: [] });
    authState.user = {
      memberships: [
        { project_id: 1, project_name: 'Alpha', role: 'admin' },
        { project_id: 2, project_name: 'Beta', role: 'member' },
      ],
    };
  });

  it('renders projects and open action for existing projects', () => {
    render(<MemoryRouter><ProjectSelectionPage /></MemoryRouter>);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Mitglied')).toBeInTheDocument();
    expect(screen.getAllByText('Öffnen').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Neues Projekt' })).toBeInTheDocument();
  });

  it('shows empty and demo start options when no projects exist', () => {
    authState.user = {
      memberships: [],
    };
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    render(<MemoryRouter><ProjectSelectionPage /></MemoryRouter>);

    expect(screen.getByRole('heading', { name: 'Erstes Projekt starten' })).toBeInTheDocument();
    expect(screen.getByText('Wähle, ob du mit einem eigenen leeren Projekt beginnst oder OpenFarmPlanner zuerst mit realistischen Beispieldaten ausprobierst.')).toBeInTheDocument();
    expect(screen.getByText('Demo-Projekt ausprobieren')).toBeInTheDocument();
    expect(screen.queryByText('Papierkorb')).not.toBeInTheDocument();
    expect(projectApiMocks.listDeleted).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Leeres Projekt anlegen' }));
    expect(dispatchSpy).toHaveBeenCalled();
    dispatchSpy.mockRestore();
  });

  it('shows first-project onboarding as a developer preview even with existing projects', () => {
    localStorage.setItem(DEV_ONBOARDING_PREVIEW_STORAGE_KEY, '1');

    render(<MemoryRouter><ProjectSelectionPage /></MemoryRouter>);

    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('Demo-Projekt ausprobieren')).toBeInTheDocument();
  });

  it('hides the trash retention notice when the trash is empty', async () => {
    render(<MemoryRouter initialEntries={['/app/project-selection?trash=1']}><ProjectSelectionPage /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Papierkorb' })).toBeInTheDocument();
    expect(await screen.findByText('Der Papierkorb ist leer.')).toBeInTheDocument();
    expect(screen.queryByText('Gelöschte Projekte werden nach 30 Tagen automatisch endgültig gelöscht.')).not.toBeInTheDocument();
  });

  it('opens the project trash from an explicit URL and restores deleted projects', async () => {
    projectApiMocks.listDeleted.mockResolvedValue({
      data: [{
        id: 7,
        name: 'Gelöschtes Projekt',
        slug: 'geloeschtes-projekt',
        description: '',
        is_active: false,
        deleted_at: '2026-01-01T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }],
    });
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    render(<MemoryRouter initialEntries={['/app/project-selection?trash=1']}><ProjectSelectionPage /></MemoryRouter>);

    expect(await screen.findByRole('heading', { name: 'Papierkorb' })).toBeInTheDocument();
    expect(screen.getByText('Gelöschte Projekte werden nach 30 Tagen automatisch endgültig gelöscht.')).toBeInTheDocument();
    expect(screen.queryByText('Demo-Projekt ausprobieren')).not.toBeInTheDocument();
    expect(await screen.findByText('Gelöschtes Projekt')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Wiederherstellen' }));

    await waitFor(() => {
      expect(projectApiMocks.restore).toHaveBeenCalledWith(7);
      expect(authState.refreshUser).toHaveBeenCalled();
    });
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ofp:project-trash-changed',
    }));
    dispatchSpy.mockRestore();
  });

  it('permanently deletes a project from the trash after confirmation', async () => {
    projectApiMocks.listDeleted.mockResolvedValue({
      data: [{
        id: 7,
        name: 'Gelöschtes Projekt',
        slug: 'geloeschtes-projekt',
        description: '',
        is_active: false,
        deleted_at: '2026-01-01T00:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      }],
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    render(<MemoryRouter initialEntries={['/app/project-selection?trash=1']}><ProjectSelectionPage /></MemoryRouter>);

    expect(await screen.findByText('Gelöschtes Projekt')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Endgültig löschen' }));

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Gelöschtes Projekt'));
    await waitFor(() => expect(projectApiMocks.permanentDelete).toHaveBeenCalledWith(7));
    expect(screen.queryByText('Gelöschtes Projekt')).not.toBeInTheDocument();
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ofp:project-trash-changed',
    }));
    confirmSpy.mockRestore();
    dispatchSpy.mockRestore();
  });

  it('creates and opens a demo project from onboarding', async () => {
    authState.user = {
      memberships: [],
    };
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    render(<MemoryRouter><ProjectSelectionPage /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Demo-Projekt erstellen' }));

    await waitFor(() => {
      expect(projectApiMocks.createDemo).toHaveBeenCalledTimes(1);
      expect(authState.switchActiveProject).toHaveBeenCalledWith(9);
    });
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ofp:show-snackbar',
    }));
    dispatchSpy.mockRestore();
  });

  it('prevents duplicate demo creation while a request is running', async () => {
    authState.user = {
      memberships: [],
    };
    let resolveRequest: (value: Awaited<ReturnType<typeof projectApiMocks.createDemo>>) => void = () => {};
    projectApiMocks.createDemo.mockImplementationOnce(() => new Promise((resolve) => {
      resolveRequest = resolve;
    }));

    render(<MemoryRouter><ProjectSelectionPage /></MemoryRouter>);

    const button = screen.getByRole('button', { name: 'Demo-Projekt erstellen' });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(projectApiMocks.createDemo).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'Demo-Projekt wird erstellt…' })).toBeDisabled();
    resolveRequest({
      data: {
        id: 9,
        name: 'Solawi Sonnenacker',
        slug: 'solawi-sonnenacker',
        description: '',
        is_active: true,
        deleted_at: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    });
    await waitFor(() => expect(authState.switchActiveProject).toHaveBeenCalledWith(9));
  });

  it('quick-deletes a project from the list after dev confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<MemoryRouter><ProjectSelectionPage /></MemoryRouter>);

    const deleteButtons = screen.getAllByRole('button', { name: 'Dev: ohne Namensbestätigung löschen' });
    fireEvent.click(deleteButtons[0]);

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Alpha'));
    await waitFor(() => {
      expect(projectApiMocks.delete).toHaveBeenCalledWith(1);
      expect(authState.refreshUser).toHaveBeenCalled();
    });
    confirmSpy.mockRestore();
  });

  it('does not delete when the dev confirmation is cancelled', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<MemoryRouter><ProjectSelectionPage /></MemoryRouter>);

    const deleteButtons = screen.getAllByRole('button', { name: 'Dev: ohne Namensbestätigung löschen' });
    fireEvent.click(deleteButtons[0]);

    expect(confirmSpy).toHaveBeenCalled();
    expect(projectApiMocks.delete).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('shows a readable error when demo creation fails', async () => {
    authState.user = {
      memberships: [],
    };
    projectApiMocks.createDemo.mockRejectedValueOnce(new Error('boom'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<MemoryRouter><ProjectSelectionPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Demo-Projekt erstellen' }));

    expect(await screen.findByText('Demo-Projekt konnte nicht erstellt werden. Bitte versuche es erneut.')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
