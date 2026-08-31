import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AxiosError } from 'axios';
import { SeasonCreateSuggestionDialog, SeasonSwitcher } from '../SeasonSwitcher';
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
    const onOpenCreateSuggestion = vi.fn();

    render(
      <SeasonSwitcher
        controller={controller}
        onOpenProjectSettings={vi.fn()}
        onOpenCreateSuggestion={onOpenCreateSuggestion}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Aktive Saison wechseln' }));
    expect(screen.getByText('Saison 26/27 anlegen')).toBeInTheDocument();
    expect(screen.getByText('1.9.2026 – 31.8.2027')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Anlegen' }));

    expect(onOpenCreateSuggestion).toHaveBeenCalledTimes(1);
    render(
      <SeasonCreateSuggestionDialog
        controller={controller}
        open
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Saison 26/27 anlegen?' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Daten aus Saison 25\/26 übernehmen/ })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Anlegen' }));

    expect(createSeason).toHaveBeenCalledWith('2026-09-01', '2027-08-31', 2);
    expect(switchSeason).toHaveBeenCalledWith(3);
  });

  it('creates the suggested season without copying when the dialog option is unchecked', async () => {
    const user = userEvent.setup();
    const createSeason = vi.fn().mockResolvedValue({ ...seasons[0], id: 3, label: '26/27' });
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
      switchSeason: vi.fn(),
      renameSeason: vi.fn(),
      copyDataInto: vi.fn(),
      deleteSeason: vi.fn(),
      undoPendingDeletion: vi.fn(),
      closePendingDeletionSnackbar: vi.fn(),
    } as unknown as UseActiveSeasonReturn;

    render(
      <SeasonCreateSuggestionDialog
        controller={controller}
        open
        onClose={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('checkbox', { name: /Daten aus Saison 25\/26 übernehmen/ }));
    await user.click(screen.getByRole('button', { name: 'Anlegen' }));

    expect(createSeason).toHaveBeenCalledWith('2026-09-01', '2027-08-31', undefined);
  });

  it('keeps the create dialog open and shows a concrete conflict reason when creation fails', async () => {
    const user = userEvent.setup();
    const createSeason = vi.fn().mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 400,
        data: {
          code: 'season_unassigned_data_outside_period',
          conflict_count: '1',
          conflicts: [{ label: 'Tomate in Beet A - 2026-12-15' }],
        },
      },
    } as AxiosError);
    const onClose = vi.fn();
    const switchSeason = vi.fn();
    const controller = {
      seasons: [],
      activeSeason: null,
      dueSuggestion: {
        due: true,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
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
      <SeasonCreateSuggestionDialog
        controller={controller}
        open
        onClose={onClose}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Anlegen' }));

    expect(await screen.findByText(/Tomate in Beet A/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Saison 2026 anlegen?' })).toBeInTheDocument();
    expect(createSeason).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(switchSeason).not.toHaveBeenCalled();
  });
});
