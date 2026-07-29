import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AccountSettingsApiTokensCard from '../pages/accountSettingsApiTokensCard';
import type { ApiToken, ApiTokenCreated } from '../api/types';

const authUser = {
  memberships: [
    { project_id: 1, project_name: 'Hof Nord', role: 'admin' as const },
    { project_id: 2, project_name: 'Hof Süd', role: 'member' as const },
  ],
};

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ user: authUser }),
}));

const listMock = vi.fn();
const createMock = vi.fn();
const revokeMock = vi.fn();

vi.mock('../api/api', () => ({
  apiTokenAPI: {
    list: () => listMock(),
    create: (payload: unknown) => createMock(payload),
    revoke: (id: number) => revokeMock(id),
  },
}));

function token(overrides: Partial<ApiToken> = {}): ApiToken {
  return {
    id: 10,
    name: 'Codex',
    project: 1,
    project_name: 'Hof Nord',
    scope: 'read',
    token_prefix: 'abcd1234',
    status: 'active',
    created_at: '2026-07-01T10:00:00Z',
    expires_at: null,
    last_used_at: null,
    revoked_at: null,
    ...overrides,
  };
}

function createdToken(overrides: Partial<ApiTokenCreated> = {}): ApiTokenCreated {
  return { ...token(), token: 'ofp_pat_plaintext-shown-once', ...overrides };
}

describe('AccountSettingsApiTokensCard', () => {
  beforeEach(() => {
    listMock.mockReset();
    createMock.mockReset();
    revokeMock.mockReset();
  });

  it('lists existing tokens with their project, scope, and status', async () => {
    listMock.mockResolvedValue({ data: [token({ scope: 'write' })] });

    render(<AccountSettingsApiTokensCard />);

    expect(await screen.findByText('Codex')).toBeInTheDocument();
    expect(screen.getByText('Aktiv')).toBeInTheDocument();
    expect(screen.getByText('Lesen und schreiben')).toBeInTheDocument();
    expect(screen.getByText(/Hof Nord/)).toBeInTheDocument();
  });

  it('never renders a full token value in the list', async () => {
    listMock.mockResolvedValue({ data: [token()] });

    render(<AccountSettingsApiTokensCard />);

    await screen.findByText('Codex');
    expect(screen.getByText(/abcd1234…/)).toBeInTheDocument();
    expect(screen.queryByText(/ofp_pat_/)).not.toBeInTheDocument();
  });

  it('shows an empty state when the user has no tokens', async () => {
    listMock.mockResolvedValue({ data: [] });

    render(<AccountSettingsApiTokensCard />);

    expect(await screen.findByText('Du hast noch keine API-Tokens erstellt.')).toBeInTheDocument();
  });

  it('creates a token for the selected project and scope', async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValue({ data: [] });
    createMock.mockResolvedValue({ data: createdToken() });

    render(<AccountSettingsApiTokensCard />);
    await screen.findByText('Du hast noch keine API-Tokens erstellt.');

    await user.click(screen.getByRole('button', { name: 'Token erstellen' }));
    await user.type(screen.getByLabelText('Name'), 'Claude Code');
    await user.click(screen.getByRole('combobox', { name: 'Berechtigungen' }));
    await user.click(await screen.findByRole('option', { name: 'Lesen und schreiben' }));
    await user.click(screen.getAllByRole('button', { name: 'Token erstellen' })[0]);

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    expect(createMock).toHaveBeenCalledWith({
      name: 'Claude Code',
      project: 1,
      scope: 'write',
      expires_at: null,
    });
  });

  it('shows the plaintext token once, with an explicit one-time warning', async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValue({ data: [] });
    createMock.mockResolvedValue({ data: createdToken() });

    render(<AccountSettingsApiTokensCard />);
    await screen.findByText('Du hast noch keine API-Tokens erstellt.');

    await user.click(screen.getByRole('button', { name: 'Token erstellen' }));
    await user.type(screen.getByLabelText('Name'), 'Codex');
    await user.click(screen.getAllByRole('button', { name: 'Token erstellen' })[0]);

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(/nur dieses eine Mal angezeigt und kann danach nicht erneut abgerufen werden/),
    ).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue('ofp_pat_plaintext-shown-once')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Ich habe das Token gespeichert' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByDisplayValue('ofp_pat_plaintext-shown-once')).not.toBeInTheDocument();
  });

  it('revokes a token and reloads the list', async () => {
    const user = userEvent.setup();
    listMock
      .mockResolvedValueOnce({ data: [token()] })
      .mockResolvedValueOnce({ data: [token({ status: 'revoked' })] });
    revokeMock.mockResolvedValue({ data: token({ status: 'revoked' }) });

    render(<AccountSettingsApiTokensCard />);
    await screen.findByText('Codex');

    await user.click(screen.getByRole('button', { name: 'Widerrufen' }));

    await waitFor(() => expect(revokeMock).toHaveBeenCalledWith(10));
    expect(await screen.findByText('Widerrufen')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Widerrufen' })).not.toBeInTheDocument();
  });

  it('offers no token creation when the user belongs to no project', async () => {
    const originalMemberships = authUser.memberships;
    authUser.memberships = [];
    listMock.mockResolvedValue({ data: [] });

    try {
      render(<AccountSettingsApiTokensCard />);

      expect(
        await screen.findByText(
          'Du musst Mitglied in einem Projekt sein, um ein API-Token erstellen zu können.',
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Token erstellen' })).toBeDisabled();
    } finally {
      authUser.memberships = originalMemberships;
    }
  });

  it('surfaces a creation error instead of pretending the token exists', async () => {
    const user = userEvent.setup();
    listMock.mockResolvedValue({ data: [] });
    createMock.mockRejectedValue(new Error('boom'));

    render(<AccountSettingsApiTokensCard />);
    await screen.findByText('Du hast noch keine API-Tokens erstellt.');

    await user.click(screen.getByRole('button', { name: 'Token erstellen' }));
    await user.type(screen.getByLabelText('Name'), 'Codex');
    await user.click(screen.getAllByRole('button', { name: 'Token erstellen' })[0]);

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
