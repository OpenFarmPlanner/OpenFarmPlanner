import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GlobalMenu } from '../navigation/GlobalMenu';

const labels: Record<string, string> = {
  'project.settings': 'Projekteinstellungen',
  'commandPalette.commands.openVersionHistory': 'Versionsverlauf öffnen',
  accountSettings: 'Kontoeinstellungen',
  'globalMenu.shortcuts': 'Tastenkürzel',
  'globalMenu.appHelp': 'App-Hilfe',
  'commandPalette.commands.logout': 'Abmelden',
  'language.label': 'Sprache',
};

const t = (key: string) => labels[key] ?? key;

const baseProps = {
  open: true,
  historyLoading: false,
  userLabel: 'test@example.com',
  isMobile: false,
  onClose: vi.fn(),
  onOpenProjectSwitcher: vi.fn(),
  onOpenCreateProject: vi.fn(),
  onOpenProjectSettings: vi.fn(),
  onOpenProjectHistory: vi.fn(async () => undefined),
  onOpenAccountSettings: vi.fn(),
  onOpenShortcuts: vi.fn(),
  onOpenHelp: vi.fn(),
  canLeaveDemoProject: false,
  isGuestDemoSession: false,
  onLeaveDemoProject: vi.fn(async () => undefined),
  onLogout: vi.fn(async () => undefined),
  t,
};

describe('GlobalMenu (desktop)', () => {
  it('keeps the global menu scoped to project, account, and application settings', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);

    render(<GlobalMenu {...baseProps} anchorEl={anchor} />);

    const menuItems = screen.getAllByRole('menuitem').map((item) => item.textContent);
    expect(menuItems).toEqual([
      'Projekteinstellungen',
      'Versionsverlauf öffnen',
      'Kontoeinstellungen',
      'Sprache',
      'Tastenkürzel',
      'App-Hilfe',
      'Abmelden test@example.com',
    ]);

    const menu = screen.getByRole('menu');
    const separators = menu.querySelectorAll('hr');
    expect(separators).toHaveLength(3);
  });

  it('does not show crop library moderation in the global menu', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);

    render(<GlobalMenu {...baseProps} anchorEl={anchor} />);

    expect(screen.queryByRole('menuitem', { name: 'Kulturbibliothek moderieren' })).not.toBeInTheDocument();
  });
});
