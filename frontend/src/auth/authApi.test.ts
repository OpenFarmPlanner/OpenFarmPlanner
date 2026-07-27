import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthApiError, login, register } from './authApi';

type MockResponse = {
  ok: boolean;
  status: number;
  body: unknown;
};

function installFetchMock(responses: MockResponse[]): void {
  const queue = [...responses];
  vi.stubGlobal('fetch', vi.fn(async () => {
    const next = queue.shift();
    if (!next) {
      throw new Error('Unexpected fetch call');
    }
    const bodyText = typeof next.body === 'string' ? next.body : JSON.stringify(next.body);
    return {
      ok: next.ok,
      status: next.status,
      headers: new Headers(),
      text: async () => bodyText,
      json: async () => JSON.parse(bodyText),
    } as Response;
  }));
}

describe('authApi error mapping', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      value: 'csrftoken=test-token',
      writable: true,
    });
  });

  it('sends explicit terms acceptance during registration', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => ({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ detail: 'ok' }),
      json: async () => ({ detail: 'ok' }),
    } as Response));
    vi.stubGlobal('fetch', fetchMock);

    await register('new@example.com', 'new-safe-password-123', 'new-safe-password-123', '', true);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const registerInit = fetchMock.mock.calls[1]?.[1];
    if (!registerInit?.body) {
      throw new Error('Expected registration request body');
    }
    const body = JSON.parse(String(registerInit.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ accept_terms: true });
  });

  it('does not expose non_field_errors and translates typical login messages', async () => {
    installFetchMock([
      { ok: true, status: 200, body: { detail: 'ok' } },
      {
        ok: false,
        status: 400,
        body: {
          non_field_errors: ['Unable to log in with provided credentials.'],
          password: ['This field is required.'],
        },
      },
    ]);

    try {
      await login('demo@example.com', '');
      throw new Error('Expected login to fail');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AuthApiError);
      const authError = error as AuthApiError;
      expect(authError.message).toContain('Anmeldung mit den eingegebenen Zugangsdaten ist fehlgeschlagen.');
      expect(authError.message).toContain('Passwort: Dieses Feld ist erforderlich.');
      expect(authError.message).not.toContain('non_field_errors');
    }
  });

  it('translates common Django password and email validation messages to German', async () => {
    installFetchMock([
      { ok: true, status: 200, body: { detail: 'ok' } },
      {
        ok: false,
        status: 400,
        body: {
          email: ['Enter a valid email address.'],
          password: ['This password is too common.', 'This password is too short.'],
        },
      },
    ]);

    try {
      await register('bad-email', '123', '123');
      throw new Error('Expected register to fail');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(AuthApiError);
      const authError = error as AuthApiError;
      expect(authError.message).toContain('E-Mail: Bitte gib eine gültige E-Mail-Adresse ein.');
      expect(authError.message).toContain('Passwort: Dieses Passwort ist zu häufig.');
      expect(authError.message).toContain('Passwort: Dieses Passwort ist zu kurz.');
    }
  });

  it('uses structured message field for email_send_failed responses', async () => {
    installFetchMock([
      { ok: true, status: 200, body: { detail: 'ok' } },
      {
        ok: false,
        status: 503,
        body: {
          code: 'email_send_failed',
          message: 'Dein Konto wurde erstellt, aber die Aktivierungs-E-Mail konnte nicht gesendet werden.',
        },
      },
    ]);

    await expect(register('bad-email', '123', '123')).rejects.toMatchObject({
      message: 'Dein Konto wurde erstellt, aber die Aktivierungs-E-Mail konnte nicht gesendet werden.',
      code: 'email_send_failed',
    });
  });

  it('does not expose raw HTML error responses', async () => {
    installFetchMock([
      { ok: true, status: 200, body: { detail: 'ok' } },
      {
        ok: false,
        status: 500,
        body: '<!DOCTYPE html><html><body><h1>500 Internal Server Error</h1><pre>SMTP stack</pre></body></html>',
      },
    ]);

    await expect(login('demo@example.com', 'secret')).rejects.toMatchObject({
      message: 'Anfrage fehlgeschlagen.',
    });
  });
});
