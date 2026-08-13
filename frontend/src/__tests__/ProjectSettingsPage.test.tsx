import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import ProjectSettingsPage from '../pages/ProjectSettingsPage';

const inviteMock = vi.fn(async () => ({ data: { code: 'invitation_sent', mail_sent: true } }));
const listMock = vi.fn(async () => ({ data: [] }));
const listMembersMock = vi.fn(async () => ({
  data: [
    {
      id: 11,
      user: 2,
      user_email: 'member@example.com',
      user_display_name: 'Member Name',
      project: 1,
      role: 'member',
      created_at: '2026-03-18T08:00:00Z',
    },
  ],
}));
const updateMemberMock = vi.fn(async () => ({ data: { id: 11, role: 'admin' } }));
const removeMemberMock = vi.fn(async () => ({}));
const revokeInvitationMock = vi.fn();
const updateProjectMock = vi.fn(async () => ({ data: { id: 1, name: 'Beta' } }));
const deleteProjectMock = vi.fn(async () => ({}));
const restoreProjectMock = vi.fn(async () => ({ data: { id: 1, name: 'Alpha' } }));
const refreshUserMock = vi.fn(async () => null);

const authState = {
  user: {
    id: 1,
    memberships: [{ project_id: 1, project_name: 'Alpha', role: 'admin' as const }],
  },
  refreshUser: refreshUserMock,
};

vi.mock('../auth/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    projectAPI: {
      ...actual.projectAPI,
      invite: (...args: unknown[]) => inviteMock(...args),
      listInvitations: (...args: unknown[]) => listMock(...args),
      listMembers: (...args: unknown[]) => listMembersMock(...args),
      updateMember: (...args: unknown[]) => updateMemberMock(...args),
      removeMember: (...args: unknown[]) => removeMemberMock(...args),
      revokeInvitation: (...args: unknown[]) => revokeInvitationMock(...args),
      update: (...args: unknown[]) => updateProjectMock(...args),
      delete: (...args: unknown[]) => deleteProjectMock(...args),
      restore: (...args: unknown[]) => restoreProjectMock(...args),
    },
  };
});

describe('ProjectSettingsPage', () => {
  beforeEach(() => {
    window.localStorage.setItem('activeProjectId', '1');
    authState.user = {
      id: 1,
      memberships: [{ project_id: 1, project_name: 'Alpha', role: 'admin' }],
    };
    inviteMock.mockClear();
    listMock.mockClear();
    listMembersMock.mockClear();
    updateMemberMock.mockClear();
    removeMemberMock.mockClear();
    revokeInvitationMock.mockClear();
    updateProjectMock.mockClear();
    deleteProjectMock.mockClear();
    restoreProjectMock.mockClear();
    refreshUserMock.mockClear();
    listMock.mockResolvedValue({ data: [] });
    listMembersMock.mockResolvedValue({
      data: [
        {
          id: 11,
          user: 2,
          user_email: 'member@example.com',
          user_display_name: 'Member Name',
          project: 1,
          role: 'member',
          created_at: '2026-03-18T08:00:00Z',
        },
      ],
    });
  });

  it('invites a user from project settings page', async () => {
    render(<MemoryRouter><ProjectSettingsPage /></MemoryRouter>);
    await waitFor(() => expect(listMock).toHaveBeenCalledWith(1));
    await waitFor(() => expect(listMembersMock).toHaveBeenCalledWith(1));

    fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'invitee@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Einladung senden' }));

    await waitFor(() => expect(inviteMock).toHaveBeenCalledWith(1, { email: 'invitee@example.com', role: 'member' }));
  });

  it('updates member roles and removes members from project settings page', async () => {
    render(<MemoryRouter><ProjectSettingsPage /></MemoryRouter>);

    await screen.findByText('Member Name');
    fireEvent.mouseDown(screen.getAllByRole('combobox')[1]);
    fireEvent.click(await screen.findByRole('option', { name: 'Admin' }));
    await waitFor(() => expect(updateMemberMock).toHaveBeenCalledWith(1, 11, 'admin'));

    fireEvent.click(screen.getByRole('button', { name: 'Aus Projekt entfernen' }));
    expect(await screen.findByText('Mitglied wirklich entfernen?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Jetzt entfernen' }));
    await waitFor(() => expect(removeMemberMock).toHaveBeenCalledWith(1, 11));
  });

  it('uses the member email as the primary label when the display name is empty', async () => {
    listMembersMock.mockResolvedValueOnce({
      data: [
        {
          id: 12,
          user: 1,
          user_email: 'martin.stipsitz@gmail.com',
          user_display_name: '',
          project: 1,
          role: 'admin',
          created_at: '2026-03-18T08:00:00Z',
        },
      ],
    });

    render(<MemoryRouter><ProjectSettingsPage /></MemoryRouter>);

    expect(await screen.findByText('martin.stipsitz@gmail.com')).toBeInTheDocument();
    expect(screen.queryByText('Ohne Anzeigenamen')).not.toBeInTheDocument();
  });

  it('shows a neutral no-access state for invitations when the user is not an admin', async () => {
    authState.user = {
      id: 1,
      memberships: [{ project_id: 1, project_name: 'Alpha', role: 'member' }],
    };

    render(<MemoryRouter><ProjectSettingsPage /></MemoryRouter>);

    await waitFor(() => expect(listMembersMock).toHaveBeenCalledWith(1));
    await waitFor(() => expect(listMock).not.toHaveBeenCalled());
    expect(await screen.findByText('Nur Admins können Einladungen sehen und verwalten.')).toBeInTheDocument();
    expect(screen.getByText('Nur Admins können Einladungen senden und verwalten.')).toBeInTheDocument();
    expect(screen.queryByText('Es gibt aktuell keine Einladungen.')).not.toBeInTheDocument();
    expect(screen.queryByText('Einladungen konnten nicht geladen werden.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Einladung senden' })).toBeDisabled();
  });

  it('shows invitation load errors only for admins when the API fails', async () => {
    listMock.mockRejectedValueOnce(new Error('boom'));

    render(<MemoryRouter><ProjectSettingsPage /></MemoryRouter>);

    expect(await screen.findByText('Einladungen konnten nicht geladen werden.')).toBeInTheDocument();
  });

  it('shows a warning alert when invitation mail delivery fails', async () => {
    inviteMock.mockResolvedValueOnce({
      data: {
        code: 'invitation_sent',
        mail_sent: false,
        invite_link: 'https://example.org/openfarmplanner/invite/accept?token=test-token',
      },
    });

    render(<MemoryRouter><ProjectSettingsPage /></MemoryRouter>);
    await waitFor(() => expect(listMock).toHaveBeenCalledWith(1));

    fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'invitee@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Einladung senden' }));

    const warningMessage = await screen.findByText(/Einladung erstellt, aber E-Mail konnte nicht zugestellt werden\./);
    const alertElement = warningMessage.closest('.MuiAlert-root');
    expect(alertElement).not.toBeNull();
    expect(alertElement?.className).toContain('MuiAlert-colorWarning');
  });

  it('prefers structured backend message for invitation errors and hides HTML details', async () => {
    inviteMock.mockRejectedValueOnce({
      response: {
        data: {
          code: 'email_send_failed',
          message: 'Die E-Mail konnte nicht gesendet werden. Bitte kontaktiere info@openfarmplanner.org.',
          detail: '<!DOCTYPE html><html><body>500 Internal Server Error</body></html>',
        },
      },
    });

    render(<MemoryRouter><ProjectSettingsPage /></MemoryRouter>);
    await waitFor(() => expect(listMock).toHaveBeenCalledWith(1));

    fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'invitee@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Einladung senden' }));

    expect(await screen.findByText(/Die E-Mail konnte nicht gesendet werden\./)).toBeInTheDocument();
    expect(screen.getByText(/info@openfarmplanner.org/)).toBeInTheDocument();
    expect(screen.queryByText(/Internal Server Error/)).not.toBeInTheDocument();
  });

  it('sorts invitations by expiry date descending', async () => {
    listMock.mockResolvedValueOnce({
      data: [
        {
          id: 2,
          email: 'older@example.com',
          role: 'member',
          token: 'older-token',
          status: 'pending',
          resolved_status: 'pending',
          expires_at: '2026-04-11T13:07:30Z',
          accepted_at: null,
          revoked_at: null,
          created_at: '2026-03-28T13:07:30Z',
        },
        {
          id: 1,
          email: 'newer@example.com',
          role: 'member',
          token: 'newer-token',
          status: 'pending',
          resolved_status: 'pending',
          expires_at: '2026-04-12T08:58:52Z',
          accepted_at: null,
          revoked_at: null,
          created_at: '2026-03-29T08:58:52Z',
        },
      ],
    });

    render(<MemoryRouter><ProjectSettingsPage /></MemoryRouter>);

    const newerInvitation = await screen.findByText('newer@example.com');
    const olderInvitation = screen.getByText('older@example.com');
    expect(
      newerInvitation.compareDocumentPosition(olderInvitation) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
  });

  it('shows project name in view mode and allows switching to edit mode', async () => {
    render(<MemoryRouter><ProjectSettingsPage /></MemoryRouter>);
    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(screen.getByLabelText('Projekt umbenennen')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Speichern' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Projekt umbenennen' }));
    expect(await screen.findByLabelText('Projekt umbenennen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeInTheDocument();
  });

  it('allows renaming via PATCH from edit mode', async () => {
    render(<MemoryRouter><ProjectSettingsPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Projekt umbenennen' }));
    const projectNameInput = await screen.findByLabelText('Projekt umbenennen');
    expect(projectNameInput).toHaveValue('Alpha');

    fireEvent.change(projectNameInput, { target: { value: 'Beta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(updateProjectMock).toHaveBeenCalledWith(1, { name: 'Beta' }));
    await waitFor(() => expect(refreshUserMock).toHaveBeenCalled());
  });

  it('prevents empty or unchanged project name saves', async () => {
    render(<MemoryRouter><ProjectSettingsPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Projekt umbenennen' }));
    const projectNameInput = await screen.findByLabelText('Projekt umbenennen');
    const saveButton = screen.getByRole('button', { name: 'Speichern' });

    expect(saveButton).toBeDisabled();
    fireEvent.change(projectNameInput, { target: { value: '   ' } });
    expect(saveButton).toBeDisabled();
    expect(updateProjectMock).not.toHaveBeenCalled();
  });

  it('submits rename on Enter key', async () => {
    render(<MemoryRouter><ProjectSettingsPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Projekt umbenennen' }));
    const projectNameInput = await screen.findByLabelText('Projekt umbenennen');
    fireEvent.change(projectNameInput, { target: { value: 'Gamma' } });
    fireEvent.keyDown(projectNameInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => expect(updateProjectMock).toHaveBeenCalledWith(1, { name: 'Gamma' }));
  });

  it('cancels edit mode on Escape without API call', async () => {
    render(<MemoryRouter><ProjectSettingsPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Projekt umbenennen' }));
    const projectNameInput = await screen.findByLabelText('Projekt umbenennen');

    fireEvent.change(projectNameInput, { target: { value: 'Delta' } });
    fireEvent.keyDown(projectNameInput, { key: 'Escape', code: 'Escape' });

    expect(updateProjectMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Projekt umbenennen')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('cancels edit mode via cancel button without API call', async () => {
    render(<MemoryRouter><ProjectSettingsPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Projekt umbenennen' }));
    const projectNameInput = await screen.findByLabelText('Projekt umbenennen');

    fireEvent.change(projectNameInput, { target: { value: 'Delta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(updateProjectMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Projekt umbenennen')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('offers a developer shortcut to delete the active project without typing its name', async () => {
    render(<MemoryRouter><ProjectSettingsPage /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Dev: ohne Namensbestätigung löschen' }));

    await waitFor(() => expect(deleteProjectMock).toHaveBeenCalledWith(1));
    await waitFor(() => expect(refreshUserMock).toHaveBeenCalled());
  });
});
