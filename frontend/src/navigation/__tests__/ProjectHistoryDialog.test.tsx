import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import i18n from '../../i18n';
import { ProjectHistoryDialog } from '../ProjectHistoryDialog';
import type { CultureHistoryEntry } from '../../api/types';

const t = i18n.getFixedT('de', 'navigation');
const tCultures = i18n.getFixedT('de', 'cultures');

function entry(partial: Partial<CultureHistoryEntry>): CultureHistoryEntry {
  return {
    history_id: Math.floor(Math.random() * 1e6),
    history_date: '2026-08-30T12:37:00.000Z',
    history_type: 'project_snapshot',
    history_user: 'Martin',
    summary: '',
    actor_label: 'Martin',
    ...partial,
  };
}

function renderDialog(items: CultureHistoryEntry[], onRestore = vi.fn()) {
  render(
    <MemoryRouter>
      <ProjectHistoryDialog
        open
        items={items}
        isPhonePortrait={false}
        fallbackActorLabel="Martin"
        formatTimestamp={(value) => new Date(value).toLocaleString('de-DE')}
        onClose={vi.fn()}
        onRestore={onRestore}
        t={t}
        tCultures={tCultures}
      />
    </MemoryRouter>,
  );
  return { onRestore };
}

describe('ProjectHistoryDialog', () => {
  it('collapses a cascade into one summarized, expandable batch row', async () => {
    const user = userEvent.setup();
    const child1 = entry({ object_type: 'planting_plan', object_display_name: 'Salat / Beet 1', action: 'deleted' });
    const child2 = entry({ object_type: 'planting_plan', object_display_name: 'Karotte / Beet 2', action: 'deleted' });
    const { onRestore } = renderDialog([
      entry({
        is_batch: true,
        batch_id: 7,
        batch_operation_type: 'season_delete',
        batch_context: { season_label: '25/26' },
        children: [child1, child2],
      }),
    ]);

    expect(screen.getByText('Saison 25/26 gelöscht: 2 Anbaupläne gelöscht')).toBeInTheDocument();
    // Children are hidden until expanded.
    expect(screen.queryByText(/Salat \/ Beet 1/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Einzeländerungen anzeigen' }));

    expect(screen.getByText(/Salat \/ Beet 1/)).toBeInTheDocument();
    const restoreButtons = screen.getAllByRole('button', { name: 'Version wiederherstellen' });
    expect(restoreButtons).toHaveLength(2);

    await user.click(restoreButtons[0]);
    expect(onRestore).toHaveBeenCalledWith(child1);
  });

  it('renders a single-child batch as a plain entry, not a group', () => {
    renderDialog([
      entry({
        is_batch: true,
        batch_id: 9,
        batch_operation_type: 'season_delete',
        batch_context: { season_label: '25/26' },
        children: [entry({ object_type: 'season', object_display_name: '25/26', action: 'deleted' })],
      }),
    ]);

    expect(screen.queryByRole('button', { name: 'Einzeländerungen anzeigen' })).not.toBeInTheDocument();
    expect(screen.getByText(/25\/26/)).toBeInTheDocument();
  });

  it('still lists ungrouped revisions flat', () => {
    renderDialog([
      entry({ object_type: 'culture', object_display_name: 'Bijella', action: 'updated' }),
    ]);

    expect(screen.getByText(/Bijella/)).toBeInTheDocument();
  });
});
