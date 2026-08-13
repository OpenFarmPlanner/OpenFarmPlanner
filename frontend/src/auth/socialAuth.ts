/**
 * Client side of the Google/Microsoft login flow.
 *
 * The handshake itself is a full-page navigation, not an XHR: the browser has
 * to visit the provider and come back to the backend callback, which then
 * redirects into the SPA. Starting it therefore means submitting a real form
 * (POST, so a third party cannot trigger a login through a link or image),
 * while the read-only endpoints around it use the regular auth client.
 */
import { csrfHeader, ensureCsrfCookie, request } from './authApi';

export type SocialProviderId = 'google' | 'microsoft';

export interface SocialProvider {
  id: SocialProviderId;
  name: string;
  /** Absolute path of the backend endpoint that starts the handshake. */
  login_url: string;
}

export interface SocialConnection {
  id: number;
  provider: SocialProviderId;
  provider_name: string;
  /** Email address reported by the provider, when the provider payload includes one. */
  email?: string | null;
  connected_at: string;
  /** False while this is the account's only remaining way to sign in. */
  can_disconnect: boolean;
}

/** Query parameter the backend uses to report a failed social login. */
export const SOCIAL_ERROR_PARAM = 'social_error';
/** Query parameter the backend uses to report a completed provider connect. */
export const SOCIAL_STATUS_PARAM = 'social_status';

export function getSocialProviders(): Promise<SocialProvider[]> {
  return request<SocialProvider[]>('/auth/social/providers/', { method: 'GET' });
}

export function getSocialConnections(): Promise<SocialConnection[]> {
  return request<SocialConnection[]>('/auth/social/connections/', { method: 'GET' });
}

export async function disconnectSocialConnection(connectionId: number): Promise<{ detail: string }> {
  await ensureCsrfCookie();
  return request<{ detail: string }>('/auth/social/disconnect/', {
    method: 'POST',
    headers: csrfHeader(),
    body: JSON.stringify({ id: connectionId }),
  });
}

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() ?? null;
  }
  return null;
}

function appendHiddenField(form: HTMLFormElement, name: string, value: string): void {
  const field = document.createElement('input');
  field.type = 'hidden';
  field.name = name;
  field.value = value;
  form.appendChild(field);
}

/**
 * Leave the SPA and start the provider handshake.
 *
 * @param provider - Provider to authenticate with.
 * @param options.process - `login` signs in (or signs up), `connect` links the
 *   provider to the account of the current session.
 */
export async function startSocialLogin(
  provider: SocialProvider,
  options: { process?: 'login' | 'connect' } = {},
): Promise<void> {
  await ensureCsrfCookie();

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = provider.login_url;
  form.style.display = 'none';
  appendHiddenField(form, 'csrfmiddlewaretoken', getCookie('csrftoken') ?? '');
  appendHiddenField(form, 'process', options.process ?? 'login');

  document.body.appendChild(form);
  form.submit();
}
