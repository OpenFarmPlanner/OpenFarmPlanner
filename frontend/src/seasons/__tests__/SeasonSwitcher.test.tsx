import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SeasonSwitcher } from '../SeasonSwitcher';
import type { Season } from '../../api/types';
import type { UseActiveSeasonReturn } from '../useActiveSeason';

const seasons: Season[] = [
  {
    id: 2,
    project: 1,
    start_date: '2025-09-01',
    end_date: '2026-08-31',
    custom_label: '',
    label: '25/26',
    computed_label: '25/26',
    planting_plan_count: 0,
    created_at: '',
    updated_at: '',
  },
  {
    id: 1,
    project: 1,
    start_date: '2024-09-01',
    end_date: '2025-08-31',
    custom_label: '',
    label: '24/25',
    computed_label: '24/25',
    planting_plan_count: 0,
    created_at: '',
    updated_at: '',
  },
];

describe('SeasonSwitcher', () => {
  it('offers and creates the season following the latest existing season', async () => {
    const user = userEvent.setup();
    const createSeason = vi.fn().mockResolvedValue({ ...seasons[0], id: 3, label: '26/27' });
    const switchSeason = vi.fn();
    const controller = {
      seasons,
      activeSeason: seasons[0],
      dueSuggestion: {
        due: true,
        start_date: '2026-09-01',
        end_date: '2027-08-31',
      },
      pendingDeletions: [],
      createSeason,
      switchSeason,
      renameSeason: vi.fn(),
      copyDataInto: vi.fn(),
      deleteSeason: vi.fn(),
      undoPendingDeletion: vi.fn(),
      closePendingDeletionSnackbar: vi.fn(),
    } as unknown as UseActiveSeasonReturn;

    render(
      <SeasonSwitcher
        controller={controller}
        onOpenProjectSettings={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Aktive Saison wechseln' }));
    expect(screen.getByText('Saison 26/27 anlegen')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Anlegen' }));

    expect(createSeason).toHaveBeenCalledWith('2026-09-01', '2027-08-31', 2);
    expect(switchSeason).toHaveBeenCalledWith(3);
  });
});
