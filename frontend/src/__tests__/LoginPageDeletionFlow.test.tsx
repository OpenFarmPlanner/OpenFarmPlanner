import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import LoginPage from '../pages/auth/LoginPage';
import { AuthApiError } from '../auth/authApi';

const loginMock = vi.fn();
const restoreMock = vi.fn();

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: null,
    login: loginMock,
    restoreAccount: restoreMock,
  }),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    projectAPI: {
      ...actual.projectAPI,
      getPendingInvitation: vi.fn(async () => ({ data: { code: 'no_pending_invitation' } })),
    },
  };
});

describe('LoginPage deletion flow', () => {
  it('shows restore option for account_pending_deletion', async () => {
    loginMock.mockRejectedValueOnce(new AuthApiError('pending', 'account_pending_deletion', new Date().toISOString()));
    restoreMock.mockResolvedValueOnce({ memberships: [], needs_project_selection: true });

    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'demo@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(await screen.findByRole('button', { name: 'Konto wiederherstellen' })).toBeInTheDocument();
  });

  it('lets keyboard users toggle password visibility without moving focus', async () => {
    const user = userEvent.setup();

    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    const toggleButton = screen.getByRole('button', { name: 'Passwort anzeigen' });

    await user.tab();
    await user.tab();
    await user.tab();

    expect(toggleButton).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(passwordInput.type).toBe('text');
    expect(toggleButton).toHaveFocus();
    expect(toggleButton).toHaveAccessibleName('Passwort ausblenden');

    await user.keyboard(' ');
    expect(passwordInput.type).toBe('password');
    expect(toggleButton).toHaveFocus();
    expect(toggleButton).toHaveAccessibleName('Passwort anzeigen');
  });
});
