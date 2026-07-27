import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import SocialLoginButtons from '../components/auth/SocialLoginButtons';
import type { SocialProvider } from '../auth/socialAuth';

const getSocialProvidersMock = vi.fn();
const startSocialLoginMock = vi.fn();

vi.mock('../auth/socialAuth', async () => {
  const actual = await vi.importActual<typeof import('../auth/socialAuth')>('../auth/socialAuth');
  return {
    ...actual,
    getSocialProviders: () => getSocialProvidersMock(),
    startSocialLogin: (provider: SocialProvider) => startSocialLoginMock(provider),
  };
});

const providers: SocialProvider[] = [
  { id: 'google', name: 'Google', login_url: '/api/auth/social/google/login/' },
  { id: 'microsoft', name: 'Microsoft', login_url: '/api/auth/social/microsoft/login/' },
];

function renderButtons(initialPath = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <SocialLoginButtons />
    </MemoryRouter>,
  );
}

describe('SocialLoginButtons', () => {
  beforeEach(() => {
    getSocialProvidersMock.mockReset();
    startSocialLoginMock.mockReset();
  });

  it('offers Google and Microsoft above the separator', async () => {
    getSocialProvidersMock.mockResolvedValue(providers);

    renderButtons();

    expect(await screen.findByRole('button', { name: 'Mit Google anmelden' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mit Microsoft anmelden' })).toBeInTheDocument();
    expect(screen.getByText('oder')).toBeInTheDocument();
  });

  it('names only the configured provider in the legal notice when just Google is enabled', async () => {
    getSocialProvidersMock.mockResolvedValue([providers[0]]);

    renderButtons();

    expect(await screen.findByText(/Bei der ersten Anmeldung über Google wird/)).toBeInTheDocument();
    expect(screen.queryByText(/Microsoft/)).not.toBeInTheDocument();
  });

  it('names both providers in the legal notice once Google and Microsoft are enabled', async () => {
    getSocialProvidersMock.mockResolvedValue(providers);

    renderButtons();

    expect(
      await screen.findByText(/Bei der ersten Anmeldung über Google oder Microsoft wird/),
    ).toBeInTheDocument();
  });

  it('renders nothing when the deployment has no provider configured', async () => {
    getSocialProvidersMock.mockResolvedValue([]);

    const { container } = renderButtons();

    await waitFor(() => expect(getSocialProvidersMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the providers cannot be loaded', async () => {
    getSocialProvidersMock.mockRejectedValue(new Error('offline'));

    const { container } = renderButtons();

    await waitFor(() => expect(getSocialProvidersMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a loading state and disables both buttons while redirecting', async () => {
    const user = userEvent.setup();
    getSocialProvidersMock.mockResolvedValue(providers);
    startSocialLoginMock.mockReturnValue(new Promise(() => {}));

    renderButtons();
    await user.click(await screen.findByRole('button', { name: 'Mit Google anmelden' }));

    expect(await screen.findByRole('button', { name: 'Weiterleitung zu Google…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Mit Microsoft anmelden' })).toBeDisabled();
    expect(startSocialLoginMock).toHaveBeenCalledWith(providers[0]);
  });

  it('reports a failure to start the login', async () => {
    const user = userEvent.setup();
    getSocialProvidersMock.mockResolvedValue(providers);
    startSocialLoginMock.mockRejectedValue(new Error('network'));

    renderButtons();
    await user.click(await screen.findByRole('button', { name: 'Mit Google anmelden' }));

    expect(
      await screen.findByText('Die Anmeldung konnte nicht gestartet werden. Bitte versuche es erneut.'),
    ).toBeInTheDocument();
  });

  it('explains a rejected linking attempt reported by the backend', async () => {
    getSocialProvidersMock.mockResolvedValue(providers);

    renderButtons('/login?social_error=email_conflict');

    expect(
      await screen.findByText(/Für diese E-Mail-Adresse gibt es bereits ein Konto/),
    ).toBeInTheDocument();
  });

  it('explains an aborted login', async () => {
    getSocialProvidersMock.mockResolvedValue(providers);

    renderButtons('/login?social_error=cancelled');

    expect(await screen.findByText('Die Anmeldung wurde abgebrochen.')).toBeInTheDocument();
  });

  it('falls back to a generic message for unknown error codes', async () => {
    getSocialProvidersMock.mockResolvedValue(providers);

    renderButtons('/login?social_error=something_new');

    expect(
      await screen.findByText(/Die Anmeldung über den externen Anbieter ist fehlgeschlagen/),
    ).toBeInTheDocument();
  });
});
