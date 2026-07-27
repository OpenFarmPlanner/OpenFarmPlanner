import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { isAuthenticationExpiredError } from './errors';
import { createAuthenticationExpiredEvent } from '../auth/authEvents';

const PROD_API_PATH = '/api';

function normalizeBasePath(basePath?: string): string {
  const value = basePath && basePath.trim().length > 0 ? basePath.trim() : '/';
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

export function computeProdApiPath(viteBasePath?: string): string {
  const normalizedBasePath = normalizeBasePath(viteBasePath);
  if (normalizedBasePath === '/') {
    return PROD_API_PATH;
  }
  return `${normalizedBasePath.slice(0, -1)}${PROD_API_PATH}`;
}

function isLoopbackHostname(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname.toLowerCase());
}

function getBrowserHostname(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return window.location.hostname;
}

export function normalizeDevApiBaseURL(viteApiBaseUrl: string, browserHostname?: string): string {
  if (!viteApiBaseUrl) {
    return PROD_API_PATH;
  }

  try {
    const parsed = new URL(viteApiBaseUrl);
    const currentHostname = browserHostname ?? getBrowserHostname();
    if (currentHostname && !isLoopbackHostname(currentHostname) && isLoopbackHostname(parsed.hostname)) {
      parsed.hostname = currentHostname;
      return parsed.toString().replace(/\/$/, '');
    }
  } catch {
    return viteApiBaseUrl;
  }

  return viteApiBaseUrl;
}

/**
 * Computes the baseURL based on environment flags and API base URL configuration.
 *
 * In production, always uses PROD_API_PATH to prevent accidental server misconfiguration.
 * In development, allows VITE_API_BASE_URL to override for flexibility. When the frontend
 * is opened from another LAN device, localhost overrides are mapped to that LAN host.
 *
 * @param isProd - Whether the build is production.
 * @param viteApiBaseUrl - Base URL from VITE_API_BASE_URL environment variable (dev only).
 * @param viteBasePath - Base path from Vite (import.meta.env.BASE_URL), used in production.
 * @param browserHostname - Browser hostname override, primarily for tests.
 * @returns The computed base URL.
 */
export function computeBaseURL(
  isProd: boolean,
  viteApiBaseUrl?: string,
  viteBasePath?: string,
  browserHostname?: string,
): string {
  if (isProd) {
    return computeProdApiPath(viteBasePath);
  }
  return normalizeDevApiBaseURL(viteApiBaseUrl || PROD_API_PATH, browserHostname);
}

export function validateBaseURL(isProd: boolean, baseURL: string): void {
  if (isProd && baseURL.includes('localhost')) {
    throw new Error(
      `[httpClient] FATAL: baseURL must not contain "localhost" in production! Current baseURL: ${baseURL}`
    );
  }
}

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() ?? null;
  }
  return null;
}

const baseURL = computeBaseURL(import.meta.env.PROD, import.meta.env.VITE_API_BASE_URL, import.meta.env.BASE_URL);
validateBaseURL(import.meta.env.PROD, baseURL);

const httpClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const requestStartedAt = new WeakMap<InternalAxiosRequestConfig, number>();

httpClient.interceptors.request.use((config) => {
  requestStartedAt.set(config, Date.now());

  if (config.data instanceof FormData) {
    if (config.headers && typeof config.headers === 'object') {
      delete config.headers['Content-Type'];
    }
  }

  // Read fresh from localStorage on every request (not from React state) so a
  // project switch takes effect immediately for any request in flight, and so
  // this stays correct across the full-page reload that AuthContext triggers
  // after switchActiveProject(). See docs/architecture-overview.md
  // ("Project, user, and permission model").
  const activeProjectId = window.localStorage.getItem('activeProjectId');
  if (activeProjectId) {
    config.headers = config.headers ?? {};
    config.headers['X-Project-Id'] = activeProjectId;
  }


  const method = (config.method ?? 'get').toLowerCase();
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    const csrfToken = getCookie('csrftoken');
    if (csrfToken) {
      config.headers = config.headers ?? {};
      config.headers['X-CSRFToken'] = csrfToken;
    }
  }

  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (isAuthenticationExpiredError(error) && typeof window !== 'undefined') {
      const startedAt = error.config
        ? requestStartedAt.get(error.config as InternalAxiosRequestConfig)
        : undefined;
      window.dispatchEvent(createAuthenticationExpiredEvent(startedAt ?? Date.now()));
    }
    return Promise.reject(error);
  },
);

export default httpClient;
