import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthApiError, startGuestDemo } from '../auth/authApi';

function jsonResponse(body: Record<string, unknown>, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

async function expectStartGuestDemoError(): Promise<AuthApiError> {
  try {
    await startGuestDemo();
  } catch (error) {
    expect(error).toBeInstanceOf(AuthApiError);
    return error as AuthApiError;
  }
  throw new Error('Expected startGuestDemo to fail.');
}

describe('authApi guest demo errors', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads retry duration from the Retry-After header first', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ detail: 'CSRF cookie set' }))
      .mockResolvedValueOnce(jsonResponse(
        { detail: 'Request was throttled. Expected available in 30 seconds.', retry_after: 30 },
        { status: 429, headers: { 'Retry-After': '75' } },
      ));

    const error = await expectStartGuestDemoError();

    expect(error.status).toBe(429);
    expect(error.retryAfterSeconds).toBe(75);
  });

  it('falls back to the retry_after response field', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ detail: 'CSRF cookie set' }))
      .mockResolvedValueOnce(jsonResponse(
        { detail: 'Request was throttled. Expected available in 30 seconds.', retry_after: 30 },
        { status: 429 },
      ));

    const error = await expectStartGuestDemoError();

    expect(error.status).toBe(429);
    expect(error.retryAfterSeconds).toBe(30);
  });

  it('uses the DRF detail text only as a last retry-duration fallback', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ detail: 'CSRF cookie set' }))
      .mockResolvedValueOnce(jsonResponse(
        { detail: 'Request was throttled. Expected available in 2395 seconds.' },
        { status: 429 },
      ));

    const error = await expectStartGuestDemoError();

    expect(error.status).toBe(429);
    expect(error.retryAfterSeconds).toBe(2395);
  });
});
