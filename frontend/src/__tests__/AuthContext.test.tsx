import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useContext } from 'react';
import { AuthProvider } from '../auth/AuthContext';
import {
  AUTHENTICATION_EXPIRED_EVENT,
  createAuthenticationExpiredEvent,
} from '../auth/authEvents';
import { AuthContext } from '../auth/authContextShared';
import type { AuthUser } from '../auth/types';

const baseUser: AuthUser = {
  id: 1,
  email: 'demo@example.com',
  display_name: 'Demo',
  display_label: 'Demo',
  is_active: true,
  default_project_id: 1,
  last_project_id: 1,
  resolved_project_id: 1,
  needs_project_selection: false,
  memberships: [],
  account_pending_deletion: false,
  scheduled_deletion_at: null,
  pending_consents: [],
  public_library_terms_accepted: false,
  is_guest_demo: false,
  guest_demo_session_id: null,
};

const getMeMock = vi.hoisted(() => vi.fn(async () => baseUser));
const startGuestDemoMock = vi.hoisted(() => vi.fn(async () => ({
  ...baseUser,
  id: 2,
  email: 'demo-guest@example.invalid',
  default_project_id: 2,
  last_project_id: 2,
  resolved_project_id: 2,
  memberships: [{ project_id: 2, project_name: 'Solawi Sonnenacker', role: 'admin' as const, is_demo_project: true }],
  is_guest_demo: true,
  guest_demo_session_id: 77,
})));

vi.mock('../auth/authApi', () => ({
  getMe: getMeMock,
  login: vi.fn(),
  startGuestDemo: startGuestDemoMock,
  endGuestDemo: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  activate: vi.fn(),
  resendActivation: vi.fn(),
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
  requestAccountDeletion: vi.fn(),
  restoreAccount: vi.fn(),
  switchActiveProject: vi.fn(),
}));

function ActiveProjectProbe() {
  const auth = useContext(AuthContext);
  return <div data-testid="active-project-id">{auth?.activeProjectId ?? 'none'}</div>;
}

function LoadingProbe() {
  const auth = useContext(AuthContext);
  return <div data-testid="loading-state">{auth?.isLoading ? 'loading' : 'ready'}</div>;
}

function GuestDemoStartProbe() {
  const auth = useContext(AuthContext);
  return (
    <>
      <button type="button" onClick={() => { void auth?.startGuestDemo(); }}>Start demo</button>
      <div data-testid="active-project-id">{auth?.activeProjectId ?? 'none'}</div>
    </>
  );
}

describe('AuthProvider cross-tab project sync', () => {
  const originalLocation = window.location;

  // jsdom's window.location.reload is a non-configurable, non-writable own property,
  // so it can't be spied on (directly, or via a Proxy — the reload-invariant check
  // rejects a Proxy that reports a different value for it). Replace the whole object
  // instead, and restore the original in afterEach so no other test observes this.
  function stubLocationReload(): ReturnType<typeof vi.fn> {
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });
    return reloadSpy;
  }

  beforeEach(() => {
    window.history.pushState({}, '', '/app');
    localStorage.clear();
    sessionStorage.clear();
    getMeMock.mockClear();
    startGuestDemoMock.mockClear();
    getMeMock.mockResolvedValue(baseUser);
    startGuestDemoMock.mockResolvedValue({
      ...baseUser,
      id: 2,
      email: 'demo-guest@example.invalid',
      default_project_id: 2,
      last_project_id: 2,
      resolved_project_id: 2,
      memberships: [{ project_id: 2, project_name: 'Solawi Sonnenacker', role: 'admin', is_demo_project: true }],
      is_guest_demo: true,
      guest_demo_session_id: 77,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('reloads the page when activeProjectId changes in another tab', async () => {
    const reloadSpy = stubLocationReload();

    render(<AuthProvider><ActiveProjectProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('active-project-id')).toHaveTextContent('1'));

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'activeProjectId',
      oldValue: '1',
      newValue: '2',
    }));

    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('does not reload for unrelated storage keys or unchanged values', async () => {
    const reloadSpy = stubLocationReload();

    render(<AuthProvider><ActiveProjectProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('active-project-id')).toHaveTextContent('1'));

    window.dispatchEvent(new StorageEvent('storage', {
      key: 'someOtherKey',
      oldValue: 'a',
      newValue: 'b',
    }));
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'activeProjectId',
      oldValue: '1',
      newValue: '1',
    }));

    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('does not probe the auth session on the public landing page', async () => {
    window.history.pushState({}, '', '/');

    render(<AuthProvider><LoadingProbe /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId('loading-state')).toHaveTextContent('ready'));
    expect(getMeMock).not.toHaveBeenCalled();
  });

  it('clears stale auth state when the shared API client reports an expired session', async () => {
    render(<AuthProvider><ActiveProjectProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('active-project-id')).toHaveTextContent('1'));
    expect(localStorage.getItem('activeProjectId')).toBe('1');

    act(() => {
      window.dispatchEvent(new Event(AUTHENTICATION_EXPIRED_EVENT));
    });

    await waitFor(() => expect(screen.getByTestId('active-project-id')).toHaveTextContent('none'));
    expect(localStorage.getItem('activeProjectId')).toBeNull();
  });

  it('keeps a guest demo login when an older startup refresh fails afterwards', async () => {
    let rejectStartupRefresh: (reason?: unknown) => void = () => {};
    getMeMock.mockImplementationOnce(() => new Promise((_resolve, reject) => {
      rejectStartupRefresh = reject;
    }));

    render(<AuthProvider><GuestDemoStartProbe /></AuthProvider>);

    fireEvent.click(screen.getByRole('button', { name: 'Start demo' }));
    await waitFor(() => expect(screen.getByTestId('active-project-id')).toHaveTextContent('2'));

    await act(async () => {
      rejectStartupRefresh(new Error('Unauthorized'));
    });

    await waitFor(() => expect(screen.getByTestId('active-project-id')).toHaveTextContent('2'));
    expect(localStorage.getItem('activeProjectId')).toBe('2');
    expect(sessionStorage.getItem('guestDemoSessionId')).toBe('77');
  });

  it('ignores auth-expired events from requests that started before a new guest demo login', async () => {
    const staleRequestStartedAt = Date.now() - 1000;

    render(<AuthProvider><GuestDemoStartProbe /></AuthProvider>);

    fireEvent.click(screen.getByRole('button', { name: 'Start demo' }));
    await waitFor(() => expect(screen.getByTestId('active-project-id')).toHaveTextContent('2'));

    act(() => {
      window.dispatchEvent(createAuthenticationExpiredEvent(staleRequestStartedAt));
    });

    expect(screen.getByTestId('active-project-id')).toHaveTextContent('2');
    expect(localStorage.getItem('activeProjectId')).toBe('2');
    expect(sessionStorage.getItem('guestDemoSessionId')).toBe('77');

    act(() => {
      window.dispatchEvent(createAuthenticationExpiredEvent(Date.now() + 1000));
    });

    await waitFor(() => expect(screen.getByTestId('active-project-id')).toHaveTextContent('none'));
  });
});
