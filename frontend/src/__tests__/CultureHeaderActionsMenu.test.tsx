import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TFunction } from 'i18next';
import { CultureHeaderActionsMenu } from '../cultures/CultureHeaderActionsMenu';

const labels: Record<string, string> = {
  'buttons.edit': 'Bearbeiten',
  'buttons.versions': 'Versionen',
  'buttons.exportCulture': 'Kultur exportieren',
  'buttons.delete': 'Löschen',
  'library.updateButton': 'Kulturbibliothek aktualisieren',
};

const t = ((key: string) => labels[key] ?? key) as TFunction<'cultures'>;

const renderMenu = (props: { publishBlockedTooltip?: string; onPublish?: () => void; onExport?: () => void } = {}) => {
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);

  render(
    <CultureHeaderActionsMenu
      anchorEl={anchor}
      onClose={vi.fn()}
      onOpenHistory={vi.fn()}
      onExport={props.onExport ?? vi.fn()}
      onPublish={props.onPublish ?? vi.fn()}
      isPublishing={false}
      publishLabel={labels['library.updateButton']}
      publishBlockedTooltip={props.publishBlockedTooltip}
      onDelete={vi.fn()}
      t={t}
    />,
  );
};

describe('CultureHeaderActionsMenu', () => {
  it('offers a single short entry per available action', () => {
    renderMenu();

    const menuItems = screen.getAllByRole('menuitem').map((item) => item.textContent);

    expect(menuItems).toEqual([
      'Versionen',
      'Kulturbibliothek aktualisieren',
      'Kultur exportieren',
      'Löschen',
    ]);
    expect(screen.queryByRole('menuitem', { name: 'Aus Bibliothek entfernen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Veröffentlichung zurückziehen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Endgültig löschen' })).not.toBeInTheDocument();
  });

  it('locks the publish entry while a library update is undecided or was declined', async () => {
    const onPublish = vi.fn();
    const tooltip = 'Du hast eine neuere Version aus der Bibliothek abgelehnt.';
    renderMenu({ publishBlockedTooltip: tooltip, onPublish });

    const publishItem = screen.getByRole('menuitem', { name: labels['library.updateButton'] });
    expect(publishItem).toHaveAttribute('aria-disabled', 'true');
    // A disabled MenuItem drops pointer events entirely, so it can never publish.
    await userEvent.click(publishItem, { pointerEventsCheck: 0 });
    expect(onPublish).not.toHaveBeenCalled();

    await userEvent.hover(publishItem.parentElement as HTMLElement);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(tooltip);
  });

  it('keeps the publish entry usable when nothing blocks it', async () => {
    const onPublish = vi.fn();
    renderMenu({ onPublish });

    await userEvent.click(screen.getByRole('menuitem', { name: labels['library.updateButton'] }));

    expect(onPublish).toHaveBeenCalled();
  });

  it('calls onExport when the export entry is clicked', async () => {
    const onExport = vi.fn();
    renderMenu({ onExport });

    await userEvent.click(screen.getByRole('menuitem', { name: 'Kultur exportieren' }));

    expect(onExport).toHaveBeenCalled();
  });
});
