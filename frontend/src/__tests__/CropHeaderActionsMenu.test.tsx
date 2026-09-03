import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TFunction } from 'i18next';
import { CropHeaderActionsMenu } from '../crops/CropHeaderActionsMenu';

const labels: Record<string, string> = {
  'buttons.versions': 'Versionen',
  'buttons.exportCrop': 'Kultur exportieren',
  'buttons.delete': 'Löschen',
};

const t = ((key: string) => labels[key] ?? key) as TFunction<'crops'>;

const renderMenu = (props: { onExport?: () => void; onDelete?: () => void } = {}) => {
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);

  render(
    <CropHeaderActionsMenu
      anchorEl={anchor}
      onClose={vi.fn()}
      onOpenHistory={vi.fn()}
      onExport={props.onExport ?? vi.fn()}
      onDelete={props.onDelete ?? vi.fn()}
      t={t}
    />,
  );
};

describe('CropHeaderActionsMenu', () => {
  it('offers a single short entry per available action', () => {
    renderMenu();

    const menuItems = screen.getAllByRole('menuitem').map((item) => item.textContent);

    expect(menuItems).toEqual([
      'Versionen',
      'Kultur exportieren',
      'Löschen',
    ]);
    // The public-library publish/update action moved to the badge row.
    expect(screen.queryByRole('menuitem', { name: /Veröffentlichen|Kulturbibliothek aktualisieren/ }))
      .not.toBeInTheDocument();
  });

  it('calls onExport when the export entry is clicked', async () => {
    const onExport = vi.fn();
    renderMenu({ onExport });

    await userEvent.click(screen.getByRole('menuitem', { name: 'Kultur exportieren' }));

    expect(onExport).toHaveBeenCalled();
  });

  it('calls onDelete when the delete entry is clicked', async () => {
    const onDelete = vi.fn();
    renderMenu({ onDelete });

    await userEvent.click(screen.getByRole('menuitem', { name: 'Löschen' }));

    expect(onDelete).toHaveBeenCalled();
  });
});
