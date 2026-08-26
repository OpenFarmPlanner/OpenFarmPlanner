import { vi } from 'vitest';
import type { AuthUser } from '../auth/types';

export interface AuthStateMock {
  user: AuthUser | null;
  isLoading: boolean;
  activeProjectId: number | null;
  login: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
  register: ReturnType<typeof vi.fn>;
  activate: ReturnType<typeof vi.fn>;
  resendActivation: ReturnType<typeof vi.fn>;
  requestPasswordReset: ReturnType<typeof vi.fn>;
  confirmPasswordReset: ReturnType<typeof vi.fn>;
  requestAccountDeletion: ReturnType<typeof vi.fn>;
  restoreAccount: ReturnType<typeof vi.fn>;
  switchActiveProject: ReturnType<typeof vi.fn>;
  startGuestDemo: ReturnType<typeof vi.fn>;
  endGuestDemo: ReturnType<typeof vi.fn>;
}

/**
 * Auth state object for `vi.mock('../auth/useAuth', () => ({ useAuth: () => authState }))`.
 * Tests assign `user`/`activeProjectId` in their own `beforeEach`.
 */
export function createAuthStateMock(): AuthStateMock {
  return {
    user: null,
    isLoading: false,
    activeProjectId: null,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    activate: vi.fn(),
    resendActivation: vi.fn(),
    requestPasswordReset: vi.fn(),
    confirmPasswordReset: vi.fn(),
    requestAccountDeletion: vi.fn(),
    restoreAccount: vi.fn(),
    switchActiveProject: vi.fn(async () => {}),
    startGuestDemo: vi.fn(),
    endGuestDemo: vi.fn(),
  };
}

export function createTestUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 1,
    email: 'demo@example.com',
    display_name: 'Demo',
    display_label: 'Demo',
    is_active: true,
    default_project_id: 1,
    last_project_id: 1,
    resolved_project_id: 1,
    needs_project_selection: false,
    memberships: [{ project_id: 1, project_name: 'Alpha', role: 'admin' }],
    account_pending_deletion: false,
    scheduled_deletion_at: null,
    pending_consents: [],
    ...overrides,
  } as AuthUser;
}

/**
 * Makes every media query match so the topbar renders its compact (phone)
 * branch. Uses `vi.stubGlobal` so setupTests' shared `vi.unstubAllGlobals()`
 * restores the real `matchMedia` — a plain `Object.defineProperty` without
 * `configurable: true` would leave the property permanently non-configurable
 * and break later stubs in the same file.
 */
export function stubCompactTopbarViewport(): void {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('max-width') || query.includes('down'),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
}
