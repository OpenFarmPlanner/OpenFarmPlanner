import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { ReactElement } from 'react';
import type { AxiosError } from 'axios';
import Cultures from '../pages/Cultures';
import { CommandProvider } from '../commands/CommandProvider';
import { FocusManagerProvider } from '../focus/FocusManager';

const {
  listMock,
  locationListMock,
  fieldListMock,
  bedListMock,
  cropSpeciesListMock,
  publishPreviewMock,
  publicCultureListMock,
  publicCultureWithdrawMock,
  publicCultureRemoveMock,
  publishPublicMock,
  deleteMock,
  undeleteMock,
  refreshUserMock,
  authUser,
} = vi.hoisted(() => ({
  listMock: vi.fn(),
  locationListMock: vi.fn(),
  fieldListMock: vi.fn(),
  bedListMock: vi.fn(),
  cropSpeciesListMock: vi.fn(),
  publishPreviewMock: vi.fn(),
  publicCultureListMock: vi.fn(),
  publicCultureWithdrawMock: vi.fn(),
  publicCultureRemoveMock: vi.fn(),
  publishPublicMock: vi.fn(),
  deleteMock: vi.fn(),
  undeleteMock: vi.fn(),
  refreshUserMock: vi.fn(),
  authUser: {
    id: 1,
    email: 'tester@example.com',
    display_name: 'Tester',
    is_staff: false,
    is_superuser: false,
    public_library_terms_accepted: false,
  },
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    cultureAPI: {
      ...actual.cultureAPI,
      list: listMock,
      publishPreview: publishPreviewMock,
      publishPublic: publishPublicMock,
      delete: deleteMock,
      undelete: undeleteMock,
    },
    locationAPI: {
      ...actual.locationAPI,
      list: locationListMock,
    },
    fieldAPI: {
      ...actual.fieldAPI,
      list: fieldListMock,
    },
    bedAPI: {
      ...actual.bedAPI,
      list: bedListMock,
    },
    cropSpeciesAPI: {
      ...actual.cropSpeciesAPI,
      list: cropSpeciesListMock,
      propose: vi.fn(),
    },
    publicCultureAPI: {
      ...actual.publicCultureAPI,
      list: publicCultureListMock,
      withdraw: publicCultureWithdrawMock,
      remove: publicCultureRemoveMock,
    },
  };
});

vi.mock('../cultures/CultureDetail', () => ({
  CultureDetail: ({
    cultures,
    onCultureSelect,
    onCreateCulture,
    onCreatePlan,
    onPublishCulture,
    onWithdrawPublicCulture,
    onRemovePublicCulture,
    onEditCulture,
    onDeleteCulture,
    canCreatePlan,
    publishActionLabel,
    selectedCultureId,
  }: {
    cultures: Array<{ id?: number; name: string; variety?: string; cultivation_type?: string; owned_public_culture_id?: number | null }>;
    onCultureSelect: (culture: { id?: number; name: string } | null) => void;
    onCreateCulture?: () => void;
    onCreatePlan?: () => void;
    onPublishCulture?: () => void;
    onWithdrawPublicCulture?: (culture: { id?: number; name: string; owned_public_culture_id?: number | null }) => void;
    onRemovePublicCulture?: (culture: { id?: number; name: string; owned_public_culture_id?: number | null }) => void;
    onEditCulture?: (culture: { id?: number; name: string }) => void;
    onDeleteCulture?: (culture: { id?: number; name: string; variety?: string; cultivation_type?: string }) => void;
    canCreatePlan?: boolean;
    publishActionLabel?: string;
    selectedCultureId?: number;
  }): ReactElement => (
    <div data-testid="culture-detail-mock">
      <span data-testid="selected-culture-id">{selectedCultureId ?? 'none'}</span>
      {cultures.map((culture) => (
        <span key={culture.id} data-testid={`culture-row-${culture.id}`}>{culture.name}</span>
      ))}
      <button type="button" onClick={() => onCreateCulture?.()}>Kultur hinzufügen</button>
      <button type="button" onClick={() => onPublishCulture?.()}>{publishActionLabel ?? 'Veröffentlichen'}</button>
      <button type="button" onClick={() => onWithdrawPublicCulture?.(cultures[0])}>Veröffentlichung zurückziehen</button>
      <button type="button" onClick={() => onRemovePublicCulture?.(cultures[0])}>Aus Bibliothek entfernen</button>
      <button type="button" onClick={() => onCreatePlan?.()} disabled={!canCreatePlan}>Anbauplan erstellen</button>
      <button type="button" onClick={() => onEditCulture?.(cultures[0])}>Kultur bearbeiten</button>
      <button type="button" onClick={() => onDeleteCulture?.(cultures[0])}>Kultur löschen</button>
      <button type="button" onClick={() => onCultureSelect(cultures[0] ?? null)}>select-culture</button>
    </div>
  ),
}));

vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({
    user: authUser,
    refreshUser: refreshUserMock,
  }),
}));

vi.mock('../hooks/useProjectRequirement', () => ({
  useProjectRequirement: () => ({
    shouldShowProjectRequiredState: false,
    missingProjectReason: null,
  }),
}));

function renderCultures(initialPath = '/cultures'): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/cultures"
          element={(
            <FocusManagerProvider><CommandProvider><Cultures /></CommandProvider></FocusManagerProvider>
          )}
        />
      </Routes>
    </MemoryRouter>
  );
}

const waitForDeleteDialogToClose = async (): Promise<void> => {
  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: 'Kultur löschen?' })).not.toBeInTheDocument();
  });
};

describe('Cultures action area', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authUser.public_library_terms_accepted = false;
    authUser.is_staff = false;
    authUser.is_superuser = false;
    refreshUserMock.mockResolvedValue(authUser);

    listMock.mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          { id: 1, name: 'Tomate', variety: 'Roma', crop_species: 1, cultivation_type: 'pre_cultivation', growth_duration_days: 1, harvest_duration_days: 1 },
        ],
      },
    });
    deleteMock.mockResolvedValue(undefined);
    undeleteMock.mockResolvedValue({ data: { id: 1, name: 'Tomate', variety: 'Roma' } });

    publicCultureListMock.mockResolvedValue({
      data: {
        count: 0,
        next: null,
        previous: null,
        results: [],
      },
    });
    locationListMock.mockResolvedValue({ data: { results: [{ id: 1, name: 'Hof' }] } });
    fieldListMock.mockResolvedValue({ data: { results: [{ id: 1, name: 'Parzelle A', location: 1 }] } });
    bedListMock.mockResolvedValue({ data: { results: [{ id: 1, name: 'Beet A', field: 1 }] } });
    cropSpeciesListMock.mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [{ id: 1, name: 'Tomate', status: 'published' }],
      },
    });
    publishPreviewMock.mockResolvedValue({
      data: {
        crop_species: { id: 1, name: 'Tomate' },
        original_language_code: 'de',
        available_language_codes: ['de'],
        missing_required_fields: [],
        duplicates: [],
        can_publish: true,
      },
    });
    publishPublicMock.mockResolvedValue({
      data: {
        operation: 'created',
        public_culture: { id: 99, name: 'Tomate', version: 1, status: 'published' },
        duplicates: [],
      },
    });
    publicCultureWithdrawMock.mockResolvedValue({ data: { id: 77, name: 'Tomate', version: 1, status: 'withdrawn' } });
    publicCultureRemoveMock.mockResolvedValue({ data: { id: 77, name: 'Tomate', version: 1, status: 'removed' } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render a public library shortcut in the cultures action area', async () => {
    renderCultures('/cultures?cultureId=1');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Kultur hinzufügen' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Öffentliche Kulturbibliothek' })).not.toBeInTheDocument();
  });

  it('keeps public culture API idle when no public-library button is rendered', async () => {
    renderCultures();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Kultur hinzufügen' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Öffentliche Kulturbibliothek' })).not.toBeInTheDocument();
    expect(publicCultureListMock).not.toHaveBeenCalled();
  });

  it('shows duplicate publish warning when backend returns conflict', async () => {
    const duplicateError = {
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          code: 'duplicate_public_culture',
          detail: 'A similar public culture already exists.',
          duplicates: [{ id: 4, name: 'Tomate', variety: 'Roma', version: 1 }],
        },
      },
    } as AxiosError;
    publishPublicMock.mockRejectedValue(duplicateError);

    renderCultures();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Veröffentlichen' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Veröffentlichen' }));

    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText('Kultur veröffentlichen');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Jetzt veröffentlichen' }));
    fireEvent.click(await within(dialog).findByRole('checkbox', { name: /CC BY-SA 4\.0/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Jetzt veröffentlichen' }));

    await waitFor(() => {
      expect(publishPublicMock).toHaveBeenCalledWith(1, { accepted_public_library_terms: true, crop_species_id: 1, original_language_code: 'de' });
      expect(screen.getByText('Diese Kultur ist bereits öffentlich vorhanden: Tomate (Roma)')).toBeInTheDocument();
    });
    expect(refreshUserMock).not.toHaveBeenCalled();
  });

  it('shows a lightweight publishing dialog and delays license details until publishing', async () => {
    renderCultures();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Veröffentlichen' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Veröffentlichen' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Kultur veröffentlichen')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Offizielle Kulturart/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Originalsprache')).toBeInTheDocument();
    expect(within(dialog).queryByText('Zusammenfassung')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Pflichtfelder')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Dublettenprüfung')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('checkbox', { name: /CC BY-SA 4\.0/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Jetzt veröffentlichen' })).toBeEnabled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Jetzt veröffentlichen' }));
    expect(await within(dialog).findByRole('checkbox', { name: /CC BY-SA 4\.0/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Jetzt veröffentlichen' })).toBeDisabled();

    fireEvent.click(within(dialog).getByRole('checkbox', { name: /CC BY-SA 4\.0/ }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Jetzt veröffentlichen' })).toBeEnabled());
    expect(publishPublicMock).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(publishPublicMock).not.toHaveBeenCalled();
  });

  it('still runs the publishing wizard after the current public-library terms were already accepted', async () => {
    authUser.public_library_terms_accepted = true;
    renderCultures();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Veröffentlichen' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Veröffentlichen' }));

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Jetzt veröffentlichen' })).toBeEnabled());
    expect(within(dialog).queryByRole('checkbox', { name: /CC BY-SA 4\.0/ })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Jetzt veröffentlichen' }));

    await waitFor(() => {
      expect(publishPublicMock).toHaveBeenCalledWith(1, { accepted_public_library_terms: false, crop_species_id: 1, original_language_code: 'de' });
      expect(listMock).toHaveBeenCalledTimes(2);
    });
  });

  it('preselects the official crop species when the culture name matches', async () => {
    authUser.public_library_terms_accepted = true;
    listMock.mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          { id: 32, name: 'Gurke', variety: 'Arola', cultivation_type: 'pre_cultivation', growth_duration_days: 60, harvest_duration_days: 30 },
        ],
      },
    });
    cropSpeciesListMock.mockResolvedValue({
      data: {
        count: 2,
        next: null,
        previous: null,
        results: [
          { id: 1, name: 'Tomate', status: 'published' },
          { id: 12, name: 'Gurke', status: 'published' },
        ],
      },
    });

    renderCultures('/cultures?cultureId=32');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Veröffentlichen' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Veröffentlichen' }));

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => {
      expect(within(dialog).getByRole('combobox', { name: /Offizielle Kulturart/ })).toHaveValue('Gurke');
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Jetzt veröffentlichen' }));

    await waitFor(() => {
      expect(publishPublicMock).toHaveBeenCalledWith(32, {
        accepted_public_library_terms: false,
        crop_species_id: 12,
        original_language_code: 'de',
      });
    });
  });

  it('does not attempt to render public-library entries without a trigger', async () => {
    publicCultureListMock.mockResolvedValue({
      data: {
        count: 2,
        next: null,
        previous: null,
        results: [
          { id: 11, name: 'Salat', variety: 'Bijella', supplier_name: 'Reinsaat', status: 'published', version: 1, published_at: '2026-03-10T12:00:00Z' },
          { id: 12, name: ' salat ', variety: ' BIJELLA ', seed_supplier: '  rein saat  ', status: 'published', version: 1, published_at: '2026-03-11T12:00:00Z' },
        ],
      },
    });

    renderCultures();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Kultur hinzufügen' })).toBeInTheDocument();
    });

    expect(screen.queryByText('Salat (Bijella)')).not.toBeInTheDocument();
    expect(publicCultureListMock).not.toHaveBeenCalled();
  });

  it('shows update label for cultures linked to an owned public culture', async () => {
    listMock.mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          { id: 1, name: 'Tomate', growth_duration_days: 1, harvest_duration_days: 1, owned_public_culture_id: 77 },
        ],
      },
    });

    renderCultures('/cultures?cultureId=1');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Öffentliche Kulturbibliothek aktualisieren' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Veröffentlichen' })).not.toBeInTheDocument();
  });

  it('withdraws an owned public culture after confirmation', async () => {
    listMock.mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          { id: 1, name: 'Tomate', growth_duration_days: 1, harvest_duration_days: 1, owned_public_culture_id: 77 },
        ],
      },
    });

    renderCultures('/cultures?cultureId=1');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Veröffentlichung zurückziehen' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Veröffentlichung zurückziehen' }));

    const dialog = await screen.findByRole('dialog', { name: 'Veröffentlichung zurückziehen?' });
    expect(dialog).toHaveTextContent('Bereits importierte Kulturen in Projekten bleiben vollständig erhalten.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Veröffentlichung zurückziehen' }));

    await waitFor(() => {
      expect(publicCultureWithdrawMock).toHaveBeenCalledWith(77);
    });
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it('removes an owned public culture with a moderation reason', async () => {
    authUser.is_staff = true;
    listMock.mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          { id: 1, name: 'Tomate', growth_duration_days: 1, harvest_duration_days: 1, owned_public_culture_id: 77 },
        ],
      },
    });

    renderCultures('/cultures?cultureId=1');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Aus Bibliothek entfernen' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Aus Bibliothek entfernen' }));

    const dialog = await screen.findByRole('dialog', { name: 'Aus Bibliothek entfernen?' });
    expect(within(dialog).getByRole('button', { name: 'Aus Bibliothek entfernen' })).toBeDisabled();
    fireEvent.mouseDown(within(dialog).getByLabelText('Grund'));
    fireEvent.click(await screen.findByRole('option', { name: 'Duplikat' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aus Bibliothek entfernen' }));

    await waitFor(() => {
      expect(publicCultureRemoveMock).toHaveBeenCalledWith(77, 'duplicate');
    });
  });

  it('does not expose hard delete from the standard culture action area', async () => {
    authUser.is_superuser = true;
    listMock.mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [
          { id: 1, name: 'Tomate', growth_duration_days: 1, harvest_duration_days: 1, owned_public_culture_id: 77 },
        ],
      },
    });

    renderCultures('/cultures?cultureId=1');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Aus Bibliothek entfernen' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Endgültig löschen' })).not.toBeInTheDocument();
  });

  it('renders a compact culture delete confirmation dialog', async () => {
    renderCultures('/cultures?cultureId=1');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Kultur löschen' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Kultur löschen' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Kultur löschen?');
    expect(dialog).toHaveTextContent('„Tomate“ löschen?');
    expect(dialog).not.toHaveTextContent('Roma');
    expect(dialog).not.toHaveTextContent('Pflanzung');
    expect(dialog).not.toHaveTextContent('8 Sekunden');
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('removes a confirmed culture deletion after server delete and shows undo feedback', async () => {
    renderCultures('/cultures?cultureId=1');

    await waitFor(() => expect(screen.getByTestId('culture-row-1')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Kultur löschen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Löschen' }));

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(1));
    expect(screen.queryByTestId('culture-row-1')).not.toBeInTheDocument();
    expect(screen.getByText('Kultur gelöscht')).toBeInTheDocument();
    await waitForDeleteDialogToClose();
    expect(screen.getByRole('button', { name: 'Rückgängig: Kultur gelöscht' })).toBeInTheDocument();
  });

  it('restores a server-deleted culture when undo is clicked', async () => {
    renderCultures('/cultures?cultureId=1');

    await waitFor(() => expect(screen.getByTestId('culture-row-1')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Kultur löschen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Löschen' }));
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(1));
    await waitForDeleteDialogToClose();
    fireEvent.click(screen.getByRole('button', { name: 'Rückgängig: Kultur gelöscht' }));

    await waitFor(() => expect(undeleteMock).toHaveBeenCalledWith(1));
    expect(screen.getByTestId('culture-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('selected-culture-id')).toHaveTextContent('1');
  });

  it('keeps a confirmed culture deletion on the server while the undo snackbar is visible', async () => {
    renderCultures('/cultures?cultureId=1');

    await waitFor(() => expect(screen.getByTestId('culture-row-1')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Kultur löschen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(1));
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Rückgängig: Kultur gelöscht' })).toBeInTheDocument();
  });

  it('keeps selection stable after confirmed delete and restores previous selection on undo', async () => {
    listMock.mockResolvedValue({
      data: {
        count: 2,
        next: null,
        previous: null,
        results: [
          { id: 1, name: 'Tomate', variety: 'Roma', cultivation_type: 'pre_cultivation', growth_duration_days: 1, harvest_duration_days: 1 },
          { id: 2, name: 'Salat', variety: 'Bijella', cultivation_type: 'direct_sowing', growth_duration_days: 1, harvest_duration_days: 1 },
        ],
      },
    });
    renderCultures('/cultures?cultureId=1');

    await waitFor(() => expect(screen.getByTestId('selected-culture-id')).toHaveTextContent('1'));
    fireEvent.click(screen.getByRole('button', { name: 'Kultur löschen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Löschen' }));
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(1));

    expect(screen.getByTestId('selected-culture-id')).toHaveTextContent('2');

    await waitForDeleteDialogToClose();
    fireEvent.click(screen.getByRole('button', { name: 'Rückgängig: Kultur gelöscht' }));

    await waitFor(() => expect(undeleteMock).toHaveBeenCalledWith(1));
    expect(screen.getByTestId('culture-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('selected-culture-id')).toHaveTextContent('1');
  });

  it('cleans pending culture deletion timers on unmount', async () => {
    const { unmount } = renderCultures('/cultures?cultureId=1');

    await waitFor(() => expect(screen.getByTestId('culture-row-1')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Kultur löschen' }));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    await vi.waitFor(() => expect(deleteMock).toHaveBeenCalledWith(1));
    unmount();
    vi.advanceTimersByTime(8000);

    expect(deleteMock).toHaveBeenCalledTimes(1);
  });

  it('disables create planting plan button with bed-specific guidance when no beds exist', async () => {
    bedListMock.mockResolvedValue({ data: { results: [] } });
    renderCultures('/cultures?cultureId=1');

    const createPlanButton = await screen.findByRole('button', { name: 'Anbauplan erstellen' });
    expect(createPlanButton).toBeDisabled();
    const fieldsBedsLink = await screen.findByRole('link', { name: 'Anbauflächen öffnen' });
    expect(fieldsBedsLink).toBeInTheDocument();
    expect(fieldsBedsLink).toHaveAttribute('href', '/app/fields-beds');
    expect(screen.queryByRole('link', { name: 'Beet anlegen' })).not.toBeInTheDocument();

    fireEvent.mouseOver(createPlanButton.parentElement as HTMLElement);
    expect(await screen.findByText('Du brauchst zuerst mindestens ein Beet. Beete werden innerhalb einer Parzelle auf der Seite Anbauflächen hinzugefügt.')).toBeInTheDocument();
  });

  it('enables create planting plan button when all prerequisites are present', async () => {
    renderCultures('/cultures?cultureId=1');
    const createPlanButton = await screen.findByRole('button', { name: 'Anbauplan erstellen' });
    await waitFor(() => expect(createPlanButton).toBeEnabled());
  });
});
