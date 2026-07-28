import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    confirmPasswordReset: vi.fn(),
  }),
}));

describe('ResetPasswordPage', () => {
  it('lets keyboard users toggle new-password visibility without moving focus', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/reset-password?uid=uid&token=token']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const passwordInput = document.querySelector('input[type="password"]') as HTMLInputElement;
    const toggleButton = screen.getAllByRole('button', { name: 'Passwort anzeigen' })[0];

    passwordInput.focus();
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
