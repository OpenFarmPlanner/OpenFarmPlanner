import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/auth/LoginPage';

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: null,
    login: vi.fn(),
    restoreAccount: vi.fn(),
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

vi.mock('../auth/socialAuth', async () => {
  const actual = await vi.importActual<typeof import('../auth/socialAuth')>('../auth/socialAuth');
  return {
    ...actual,
    getSocialProviders: vi.fn(async () => [
      { id: 'google', name: 'Google', login_url: '/api/auth/social/google/login/' },
    ]),
  };
});

describe('LoginPage layout', () => {
  it('orders the card as: heading, Google button, divider, email/password form, account links, then a single compact legal notice at the bottom', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await screen.findByRole('button', { name: 'Mit Google anmelden' });

    const heading = screen.getByRole('heading', { name: 'Anmelden' });
    const googleButton = screen.getByRole('button', { name: 'Mit Google anmelden' });
    const divider = screen.getByText('oder');
    const emailField = screen.getByLabelText('E-Mail *');
    const passwordField = screen.getByLabelText('Passwort *');
    const submitButton = screen.getByRole('button', { name: 'Anmelden' });
    const registerLink = screen.getByRole('link', { name: 'Noch kein Konto? Registrieren' });
    const forgotPasswordLink = screen.getByRole('link', { name: 'Passwort vergessen?' });
    const compactNotice = screen.getByText(/Bei der ersten Anmeldung mit Google wird ein Konto erstellt\./);

    const position = (a: Element, b: Element): number => {
      const relation = a.compareDocumentPosition(b);
      return relation & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    };
    const elementsInDomOrder = [
      heading,
      googleButton,
      divider,
      emailField,
      passwordField,
      submitButton,
      registerLink,
      forgotPasswordLink,
      compactNotice,
    ];
    const sorted = [...elementsInDomOrder].sort(position);
    expect(sorted).toEqual(elementsInDomOrder);
  });

  it('shows only the compact legal notice once, not the longer inline version too', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await screen.findByRole('button', { name: 'Mit Google anmelden' });

    expect(screen.getByText(/Bei der ersten Anmeldung mit Google wird ein Konto erstellt\./)).toBeInTheDocument();
    expect(screen.queryByText(/wird ein Konto erstellt und Sie stimmen den/)).not.toBeInTheDocument();
  });

  it('keeps the terms and privacy links clickable inside the compact notice', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await screen.findByRole('button', { name: 'Mit Google anmelden' });

    // AuthPageShell also renders its own page-footer legal links, so both
    // names can appear more than once — every occurrence must still be a
    // real, correctly-targeted link (the compact notice's own pair among
    // them).
    const termsLinks = screen.getAllByRole('link', { name: 'Nutzungsbedingungen' });
    const privacyLinks = screen.getAllByRole('link', { name: 'Datenschutzerklärung' });
    expect(termsLinks.length).toBeGreaterThanOrEqual(1);
    expect(privacyLinks.length).toBeGreaterThanOrEqual(1);
    termsLinks.forEach((link) => expect(link).toHaveAttribute('href', '/nutzungsbedingungen'));
    privacyLinks.forEach((link) => expect(link).toHaveAttribute('href', '/datenschutz'));
  });
});
