import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import ActivatePage from '../pages/auth/ActivatePage';

const activateMock = vi.fn();
const switchActiveProjectMock = vi.fn(async () => {});
const getPendingInvitationMock = vi.fn();
const acceptPendingInvitationMock = vi.fn();

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    activate: activateMock,
    switchActiveProject: switchActiveProjectMock,
  }),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    projectAPI: {
      ...actual.projectAPI,
      getPendingInvitation: (...args: unknown[]) => getPendingInvitationMock(...args),
      acceptPendingInvitation: (...args: unknown[]) => acceptPendingInvitationMock(...args),
    },
  };
});

describe('ActivatePage', () => {
  beforeEach(() => {
    activateMock.mockReset();
    switchActiveProjectMock.mockClear();
    getPendingInvitationMock.mockReset();
    acceptPendingInvitationMock.mockReset();
    window.localStorage.clear();
  });

  it('reads uid and token from query string and activates without pending invitation acceptance', async () => {
    activateMock.mockResolvedValueOnce(undefined);
    getPendingInvitationMock.mockResolvedValueOnce({ data: { code: 'no_pending_invitation', requires_auth: false } });

    render(
      <MemoryRouter initialEntries={['/activate?uid=MTA&token=abc123']}>
        <Routes>
          <Route path="/activate" element={<ActivatePage />} />
          <Route path="/app" element={<div>App</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(activateMock).toHaveBeenCalledWith('MTA', 'abc123');
    });
    await waitFor(() => {
      expect(getPendingInvitationMock).toHaveBeenCalledTimes(1);
    });
    expect(acceptPendingInvitationMock).not.toHaveBeenCalled();
    expect(switchActiveProjectMock).not.toHaveBeenCalled();
  });

  it('accepts a pending session invitation after activation', async () => {
    activateMock.mockResolvedValueOnce(undefined);
    getPendingInvitationMock.mockResolvedValueOnce({ data: { code: 'pending', requires_auth: false } });
    acceptPendingInvitationMock.mockResolvedValueOnce({ data: { code: 'accepted', project_id: 5 } });

    render(
      <MemoryRouter initialEntries={['/activate?uid=MTA&token=abc123']}>
        <Routes>
          <Route path="/activate" element={<ActivatePage />} />
          <Route path="/app" element={<div>App</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(activateMock).toHaveBeenCalledWith('MTA', 'abc123');
    });
    await waitFor(() => {
      expect(acceptPendingInvitationMock).toHaveBeenCalledTimes(1);
    });
    expect(switchActiveProjectMock).toHaveBeenCalledWith(5);
  });

  it('treats missing pending invitation during acceptance as harmless', async () => {
    activateMock.mockResolvedValueOnce(undefined);
    getPendingInvitationMock.mockResolvedValueOnce({ data: { code: 'pending', requires_auth: false } });
    acceptPendingInvitationMock.mockRejectedValueOnce({
      response: { data: { code: 'no_pending_invitation' } },
    });

    render(
      <MemoryRouter initialEntries={['/activate?uid=MTA&token=abc123']}>
        <Routes>
          <Route path="/activate" element={<ActivatePage />} />
          <Route path="/app" element={<div>App</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(activateMock).toHaveBeenCalledWith('MTA', 'abc123');
    });
    await waitFor(() => {
      expect(acceptPendingInvitationMock).toHaveBeenCalledTimes(1);
    });
    expect(switchActiveProjectMock).not.toHaveBeenCalled();
  });

  it('shows incomplete-link message only when uid or token is missing', async () => {
    render(
      <MemoryRouter initialEntries={['/activate?uid=MTA']}>
        <Routes>
          <Route path="/activate" element={<ActivatePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Aktivierungslink ist unvollständig.')).toBeTruthy();
    });

    expect(activateMock).not.toHaveBeenCalled();
    expect(acceptPendingInvitationMock).not.toHaveBeenCalled();
  });

  it('redirects back to the stored invitation accept URL after activation', async () => {
    activateMock.mockResolvedValueOnce(undefined);
    window.localStorage.setItem('ofp.invitationAcceptNext', '/invite/accept?token=abc123');
    window.localStorage.setItem('ofp.invitationAcceptToken', 'abc123');

    render(
      <MemoryRouter initialEntries={['/activate?uid=MTA&token=abc123']}>
        <Routes>
          <Route path="/activate" element={<ActivatePage />} />
          <Route path="/invite/accept" element={<div>Accept route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(activateMock).toHaveBeenCalledWith('MTA', 'abc123');
    });
    await waitFor(() => {
      expect(screen.getByText('Accept route')).toBeInTheDocument();
    });
    expect(acceptPendingInvitationMock).not.toHaveBeenCalled();
  });

  it('submits activation only once in strict mode for the same activation link', async () => {
    activateMock.mockResolvedValue(undefined);
    getPendingInvitationMock.mockResolvedValue({ data: { code: 'no_pending_invitation' } });
    acceptPendingInvitationMock.mockResolvedValue({ data: { code: 'no_pending_invitation' } });

    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/activate?uid=MTA&token=abc123']}>
          <Routes>
            <Route path="/activate" element={<ActivatePage />} />
            <Route path="/app" element={<div>App</div>} />
          </Routes>
        </MemoryRouter>
      </StrictMode>,
    );

    await waitFor(() => {
      expect(activateMock).toHaveBeenCalledWith('MTA', 'abc123');
    });
    await waitFor(() => {
      expect(activateMock).toHaveBeenCalledTimes(1);
    });
    expect(acceptPendingInvitationMock).not.toHaveBeenCalled();
  });
});
