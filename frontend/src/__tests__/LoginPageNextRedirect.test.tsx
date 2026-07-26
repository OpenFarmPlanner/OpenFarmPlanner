import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import LoginPage from '../pages/auth/LoginPage';
import type { AuthUser } from '../auth/types';

const loginMock = vi.fn();
let authUser: AuthUser | null = null;

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: authUser,
    login: loginMock,
    restoreAccount: vi.fn(),
  }),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    projectAPI: {
      ...actual.projectAPI,
      getPendingInvitation: vi.fn(async () => ({ data: { code: 'no_pending_invitation', requires_auth: true } })),
    },
  };
});

describe('LoginPage next redirect', () => {
  beforeEach(() => {
    loginMock.mockReset();
    authUser = null;
  });

  it('redirects to the next URL after successful login', async () => {
    loginMock.mockResolvedValueOnce({
      memberships: [{ project_id: 4, project_name: 'Projekt', role: 'member' }],
      needs_project_selection: false,
    });

    render(
      <MemoryRouter initialEntries={['/login?next=/invite/accept?token=abc123']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/invite/accept" element={<div>Accept route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(document.querySelector('input[type="email"]') as HTMLInputElement, { target: { value: 'invitee@example.com' } });
    fireEvent.change(document.querySelector('input[type="password"]') as HTMLInputElement, { target: { value: 'pass12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    await waitFor(() => {
      expect(screen.getByText('Accept route')).toBeInTheDocument();
    });
  });

  it('redirects already authenticated users without projects to project selection', async () => {
    authUser = {
      id: 1,
      email: 'starter@example.com',
      display_name: '',
      display_label: 'starter@example.com',
      is_active: true,
      default_project_id: null,
      last_project_id: null,
      resolved_project_id: null,
      needs_project_selection: true,
      memberships: [],
      account_pending_deletion: false,
      scheduled_deletion_at: null,
      pending_consents: [],
    };

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/app/project-selection" element={<div>Project selection route</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Project selection route')).toBeInTheDocument();
  });
});
