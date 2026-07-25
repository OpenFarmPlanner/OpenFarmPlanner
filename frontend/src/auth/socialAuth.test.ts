import { beforeEach, describe, expect, it, vi } from 'vitest';

import { startSocialLogin, type SocialProvider } from './socialAuth';

const googleProvider: SocialProvider = {
  id: 'google',
  name: 'Google',
  login_url: '/api/auth/social/google/login/',
};

function stubFetch(): void {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => JSON.stringify({ detail: 'ok' }),
    json: async () => ({ detail: 'ok' }),
  } as Response)));
}

describe('startSocialLogin', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      value: 'csrftoken=test-token',
      writable: true,
    });
    stubFetch();
  });

  it('submits a CSRF-protected POST form so a link cannot start a login', async () => {
    const submit = vi.fn();
    vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(submit);

    await startSocialLogin(googleProvider);

    const form = document.querySelector('form');
    expect(submit).toHaveBeenCalledTimes(1);
    expect(form?.method.toLowerCase()).toBe('post');
    expect(form?.getAttribute('action')).toBe('/api/auth/social/google/login/');
    const fields = Object.fromEntries(
      Array.from(form?.querySelectorAll('input') ?? []).map((input) => [input.name, input.value]),
    );
    expect(fields).toEqual({ csrfmiddlewaretoken: 'test-token', process: 'login' });
  });

  it('starts the connect process when linking a provider to an account', async () => {
    vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(vi.fn());

    await startSocialLogin(googleProvider, { process: 'connect' });

    const processField = document.querySelector<HTMLInputElement>('input[name="process"]');
    expect(processField?.value).toBe('connect');
  });
});
