import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TFunction } from 'i18next';
import { CultureHeaderActionsMenu } from '../cultures/CultureHeaderActionsMenu';

const labels: Record<string, string> = {
  'buttons.edit': 'Bearbeiten',
  'buttons.versions': 'Versionen',
  'buttons.deleteProjectCulture': 'Projektkultur löschen',
  'library.updateButton': 'Öffentliche Kulturbibliothek aktualisieren',
  'library.withdrawAction': 'Veröffentlichung zurückziehen',
  'library.removeAction': 'Aus Bibliothek entfernen',
};

const t = ((key: string) => labels[key] ?? key) as TFunction<'cultures'>;

describe('CultureHeaderActionsMenu', () => {
  it('keeps secondary project actions separate from moderation actions', () => {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);

    render(
      <CultureHeaderActionsMenu
        anchorEl={anchor}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onOpenHistory={vi.fn()}
        onPublish={vi.fn()}
        isPublishing={false}
        publishLabel={labels['library.updateButton']}
        onDelete={vi.fn()}
        onWithdrawPublicCulture={vi.fn()}
        onRemovePublicCulture={vi.fn()}
        canWithdrawPublicCulture
        canModeratePublicCulture
        t={t}
      />,
    );

    const menuItems = screen.getAllByRole('menuitem').map((item) => item.textContent);

    expect(menuItems).toEqual([
      'Versionen',
      'Öffentliche Kulturbibliothek aktualisieren',
      'Veröffentlichung zurückziehen',
      'Aus Bibliothek entfernen',
      'Projektkultur löschen',
    ]);
    expect(screen.queryByRole('menuitem', { name: 'Endgültig löschen' })).not.toBeInTheDocument();
  });
});
