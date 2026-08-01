import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TFunction } from 'i18next';
import { CultureHeaderActionsMenu } from '../cultures/CultureHeaderActionsMenu';

const labels: Record<string, string> = {
  'buttons.edit': 'Bearbeiten',
  'buttons.versions': 'Versionen',
  'buttons.delete': 'Löschen',
  'library.updateButton': 'Öffentliche Kulturbibliothek aktualisieren',
  'library.removeAction': 'Aus Bibliothek entfernen',
};

const t = ((key: string) => labels[key] ?? key) as TFunction<'cultures'>;

const renderMenu = (props: { canRemovePublicCulture: boolean }) => {
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);

  render(
    <CultureHeaderActionsMenu
      anchorEl={anchor}
      onClose={vi.fn()}
      onOpenHistory={vi.fn()}
      onPublish={vi.fn()}
      isPublishing={false}
      publishLabel={labels['library.updateButton']}
      onDelete={vi.fn()}
      onRemovePublicCulture={vi.fn()}
      canRemovePublicCulture={props.canRemovePublicCulture}
      t={t}
    />,
  );
};

describe('CultureHeaderActionsMenu', () => {
  it('offers a single short entry per action for published cultures', () => {
    renderMenu({ canRemovePublicCulture: true });

    const menuItems = screen.getAllByRole('menuitem').map((item) => item.textContent);

    expect(menuItems).toEqual([
      'Versionen',
      'Öffentliche Kulturbibliothek aktualisieren',
      'Aus Bibliothek entfernen',
      'Löschen',
    ]);
    expect(screen.queryByRole('menuitem', { name: 'Veröffentlichung zurückziehen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Endgültig löschen' })).not.toBeInTheDocument();
  });

  it('hides the library action for cultures that are not published', () => {
    renderMenu({ canRemovePublicCulture: false });

    const menuItems = screen.getAllByRole('menuitem').map((item) => item.textContent);

    expect(menuItems).toEqual([
      'Versionen',
      'Öffentliche Kulturbibliothek aktualisieren',
      'Löschen',
    ]);
  });
});
