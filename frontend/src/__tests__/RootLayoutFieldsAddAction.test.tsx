import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { CommandProvider } from '../commands/CommandProvider';
import { FocusManagerProvider } from '../focus/FocusManager';
import type { AuthUser } from '../auth/types';
import i18n from '../i18n/config';

// Regression test for a topbar bug: on /app/fields-beds with multiple
// locations (multi-location mode), the "Standort hinzufügen" action was
// registered through both the generic topbar context actions and the
// create-actions ("primary action") system, so it rendered as two
// identical buttons on desktop. RootLayout must render it only once.

const { locationListMock, fieldListMock, bedListMock } = vi.hoisted(() => ({
  locationListMock: vi.fn(),
  fieldListMock: vi.fn(),
  bedListMock: vi.fn(),
}));

const authState = {
  user: null as AuthUser | null,
  isLoading: false,
  activeProjectId: null as number | null,
  login: vi.fn(async () => (({}) as AuthUser)),
  logout: vi.fn(async () => {}),
  register: vi.fn(async () => 'ok'),
  activate: vi.fn(async () => {}),
  resendActivation: vi.fn(async () => 'ok'),
  requestPasswordReset: vi.fn(async () => 'ok'),
  confirmPasswordReset: vi.fn(async () => 'ok'),
  requestAccountDeletion: vi.fn(async () => ({ detail: 'ok', scheduled_deletion_at: new Date().toISOString() })),
  restoreAccount: vi.fn(async () => (({}) as AuthUser)),
  switchActiveProject: vi.fn(async () => {}),
  startGuestDemo: vi.fn(async () => (({}) as AuthUser)),
  endGuestDemo: vi.fn(async () => {}),
};

vi.mock('../auth/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    locationAPI: {
      ...actual.locationAPI,
      list: locationListMock,
      listAll: async () => (await locationListMock()).data,
    },
    fieldAPI: {
      ...actual.fieldAPI,
      list: fieldListMock,
      listAll: async () => (await fieldListMock()).data,
    },
    bedAPI: {
      ...actual.bedAPI,
      list: bedListMock,
      listAll: async () => (await bedListMock()).data,
    },
  };
});

describe('RootLayout fields-beds topbar "add location" action', () => {
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
    };
    authState.activeProjectId = 1;
    locationListMock.mockReset();
    fieldListMock.mockReset();
    bedListMock.mockReset();
    locationListMock.mockResolvedValue({
      data: { results: [{ id: 1, name: 'Acker am Bach' }, { id: 2, name: 'Hofgarten' }] },
    });
    fieldListMock.mockResolvedValue({ data: { results: [] } });
    bedListMock.mockResolvedValue({ data: { results: [] } });
    await i18n.changeLanguage('de');
    window.localStorage.clear();
    window.history.pushState({}, '', '/app/fields-beds');
  });

  it('renders a single "Standort hinzufügen" button when multiple locations exist', async () => {
    render(<FocusManagerProvider><CommandProvider><App /></CommandProvider></FocusManagerProvider>);

    await screen.findByText('Hofgarten', {}, { timeout: 10000 });

    expect(screen.getAllByRole('button', { name: /Standort hinzufügen/ })).toHaveLength(1);
  });

  it('offers "Parzelle hinzufügen" from the split-button dropdown in multi-location mode', async () => {
    const user = userEvent.setup();
    render(<FocusManagerProvider><CommandProvider><App /></CommandProvider></FocusManagerProvider>);

    await screen.findByText('Hofgarten', {}, { timeout: 10000 });

    await user.click(screen.getByRole('button', { name: 'Weitere Optionen' }));
    const menu = await screen.findByRole('menu');
    await user.click(within(menu).getByRole('menuitem', { name: 'Parzelle hinzufügen' }));

    // The menu item's onClick (requestInlineFieldCreation) ran without
    // throwing and closed the menu; the resulting inline DataGrid draft row
    // is exercised separately by FieldsBedsHierarchy's own tests.
    await vi.waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('offers "Standort hinzufügen" from the split-button dropdown in single-location mode and opens the add-location dialog', async () => {
    const user = userEvent.setup();
    locationListMock.mockResolvedValue({
      data: { results: [{ id: 1, name: 'Hofstelle' }] },
    });
    render(<FocusManagerProvider><CommandProvider><App /></CommandProvider></FocusManagerProvider>);

    await screen.findByRole('button', { name: /Parzelle hinzufügen/ }, { timeout: 10000 });

    await user.click(screen.getByRole('button', { name: 'Weitere Optionen' }));
    const menu = await screen.findByRole('menu');
    await user.click(within(menu).getByRole('menuitem', { name: 'Standort hinzufügen' }));

    expect(await screen.findByText('Weiteren Standort hinzufügen')).toBeInTheDocument();
  });
});
