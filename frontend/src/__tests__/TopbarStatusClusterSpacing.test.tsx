import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';
import { CommandProvider } from '../commands/CommandProvider';
import { FocusManagerProvider } from '../focus/FocusManager';
import type { AuthUser } from '../auth/types';
import i18n from '../i18n/config';

// The topbar's trailing items (season switcher, project switcher, notification
// bell, "Mehr" overflow menu) used to sit in gaps that differed by so little
// that the intended grouping was invisible: the cluster's own buttons carry
// 5-8px of horizontal padding, which swallowed the 4px/10px difference. These
// tests pin the spacing hierarchy — cluster gap clearly tighter than the
// separation from the overflow menu — and guard the compact topbar, which has
// its own, deliberately tighter sub-group.
const authState = {
  user: null as AuthUser | null,
  isLoading: false,
  activeProjectId: null as number | null,
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

vi.mock('../auth/useAuth', () => ({ useAuth: () => authState }));

const originalMatchMedia = window.matchMedia;

function mockCompactTopbarViewport(): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width') || query.includes('down'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function gapOf(element: Element): number {
  return Number.parseFloat(window.getComputedStyle(element).gap || '0');
}

describe('topbar trailing status cluster spacing', () => {
  beforeEach(async () => {
    authState.user = {
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
    } as unknown as AuthUser;
    authState.activeProjectId = 1;
    await i18n.changeLanguage('de');
    window.localStorage.clear();
    window.history.pushState({}, '', '/app/cultures');
  });

  it('groups season switcher, project switcher and bell tighter than the overflow menu', async () => {
    render(<FocusManagerProvider><CommandProvider><App /></CommandProvider></FocusManagerProvider>);

    const projectButton = await screen.findByRole('button', { name: 'Aktives Projekt wechseln' }, { timeout: 10000 });
    const cluster = projectButton.parentElement!;
    const overflowGroup = cluster.parentElement!;

    expect(cluster).toContainElement(screen.getByRole('button', { name: 'Aktive Saison wechseln' }));
    expect(cluster).toContainElement(screen.getByRole('button', { name: /Benachrichtigungen/ }));
    expect(cluster).not.toContainElement(screen.getByRole('button', { name: 'Mehr' }));
    expect(overflowGroup).toContainElement(screen.getByRole('button', { name: 'Mehr' }));

    expect(gapOf(cluster)).toBe(8);
    expect(gapOf(overflowGroup)).toBe(20);
    expect(gapOf(cluster)).toBeLessThan(gapOf(overflowGroup));
  });

  it('leaves the compact topbar sub-group spacing untouched', async () => {
    mockCompactTopbarViewport();
    try {
      render(<FocusManagerProvider><CommandProvider><App /></CommandProvider></FocusManagerProvider>);

      const moreButton = await screen.findByRole('button', { name: 'Mehr' }, { timeout: 10000 });
      const seasonButton = screen.getByRole('button', { name: 'Aktive Saison wechseln' });
      const compactGroup = moreButton.parentElement!;

      expect(compactGroup).toContainElement(seasonButton);
      expect(gapOf(compactGroup)).toBe(2);
    } finally {
      Object.defineProperty(window, 'matchMedia', { writable: true, value: originalMatchMedia });
    }
  });
});
