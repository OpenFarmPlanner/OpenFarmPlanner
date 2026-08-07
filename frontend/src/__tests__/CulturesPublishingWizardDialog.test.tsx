import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { CulturesPublishingWizardDialog } from '../pages/CulturesPublishingWizardDialog';
import type { Culture } from '../api/types';

const {
  cropSpeciesListMock,
  cropSpeciesProposeMock,
  publicCultureListMock,
  publishPreviewMock,
} = vi.hoisted(() => ({
  cropSpeciesListMock: vi.fn(),
  cropSpeciesProposeMock: vi.fn(),
  publicCultureListMock: vi.fn(),
  publishPreviewMock: vi.fn(),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    cropSpeciesAPI: {
      ...actual.cropSpeciesAPI,
      list: cropSpeciesListMock,
      propose: cropSpeciesProposeMock,
    },
    publicCultureAPI: {
      ...actual.publicCultureAPI,
      list: publicCultureListMock,
    },
    cultureAPI: {
      ...actual.cultureAPI,
      publishPreview: publishPreviewMock,
    },
  };
});

const CULTURE: Culture = {
  id: 1,
  name: 'Tomate',
  variety: 'Roma',
  growth_duration_days: 90,
  harvest_duration_days: 60,
};

const renderWizard = (culture: Culture = CULTURE) => render(
  <MemoryRouter>
    <CulturesPublishingWizardDialog
      open
      culture={culture}
      termsAlreadyAccepted
      publishing={false}
      onClose={vi.fn()}
      onPublish={vi.fn()}
    />
  </MemoryRouter>,
);

describe('CulturesPublishingWizardDialog', () => {
  beforeEach(() => {
    cropSpeciesListMock.mockReset();
    cropSpeciesListMock.mockResolvedValue({
      data: { count: 1, next: null, previous: null, results: [{ id: 1, name: 'Tomate', status: 'published' }] },
    });
    cropSpeciesProposeMock.mockReset();
    cropSpeciesProposeMock.mockResolvedValue({ data: { id: 2, name: 'Kürbis', status: 'proposed' } });
    publicCultureListMock.mockReset();
    publicCultureListMock.mockResolvedValue({ data: { results: [] } });
    publishPreviewMock.mockReset();
    publishPreviewMock.mockResolvedValue({
      data: {
        crop_species: { id: 1, name: 'Tomate' },
        original_language_code: 'de',
        available_language_codes: ['de'],
        missing_required_fields: [],
        duplicates: [],
        can_publish: true,
        general_crop_notice: null,
      },
    });
  });

  it('does not render a general-crop vs. variety toggle', async () => {
    renderWizard();

    await waitFor(() => expect(screen.getByLabelText(/Offizielle Kulturart/i)).toBeInTheDocument());

    expect(screen.queryByText('Veröffentlichen als')).not.toBeInTheDocument();
    expect(screen.queryByText('Allgemeine Kultur')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });

  it('offers an inline crop species proposal when the search has no matches, and lets the variety publish right away', async () => {
    cropSpeciesListMock.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });

    renderWizard();

    const speciesInput = await screen.findByLabelText(/Offizielle Kulturart/i);
    const user = userEvent.setup();
    await user.type(speciesInput, 'Kürbis');

    const proposeButton = await screen.findByRole('button', { name: /Kürbis.*als neue Kulturart vorschlagen/i });
    fireEvent.click(proposeButton);

    await waitFor(() => expect(cropSpeciesProposeMock).toHaveBeenCalledWith('Kürbis'));

    // The freshly proposed (pending) species is immediately usable: it
    // becomes the selected value, a notice explains the provisional state,
    // and "Publish now" is enabled rather than staying blocked on moderation.
    expect(await screen.findByDisplayValue('Kürbis')).toBeInTheDocument();
    expect(screen.getByText(/Dein Vorschlag für die neue Kulturart „Kürbis“ wurde zur Prüfung eingereicht/)).toBeInTheDocument();

    const publishButton = screen.getByRole('button', { name: 'Jetzt veröffentlichen' });
    expect(publishButton).toBeEnabled();
    fireEvent.click(publishButton);

    await waitFor(() => expect(publishPreviewMock).toHaveBeenCalledWith(
      CULTURE.id,
      expect.objectContaining({ crop_species_id: 2 }),
    ));
  });

  it('matches an existing species by its localized display name, not just the canonical name', async () => {
    // Regression test: canonical `name` may be in a different language than
    // what the user types/sees (e.g. canonical "Pumpkin", German
    // display_name "Kürbis"). The picker must match on display_name, or a
    // species that already exists looks missing and users are wrongly
    // steered into proposing a duplicate that the backend then rejects.
    cropSpeciesListMock.mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [{ id: 9, name: 'Pumpkin', display_name: 'Kürbis', status: 'published' }],
      },
    });

    renderWizard();

    const speciesInput = await screen.findByLabelText(/Offizielle Kulturart/i);
    const user = userEvent.setup();
    await user.clear(speciesInput);
    await user.type(speciesInput, 'Kürbis');

    expect(await screen.findByRole('option', { name: 'Kürbis' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /als neue Kulturart vorschlagen/i })).not.toBeInTheDocument();
  });

  it('shows an inline error when proposing a species fails', async () => {
    cropSpeciesListMock.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });
    cropSpeciesProposeMock.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 400,
        data: { name: ['This crop species already exists or has already been proposed.'] },
      },
    });

    renderWizard();

    const speciesInput = await screen.findByLabelText(/Offizielle Kulturart/i);
    const user = userEvent.setup();
    await user.type(speciesInput, 'Kürbis');

    const proposeButton = await screen.findByRole('button', { name: /Kürbis.*als neue Kulturart vorschlagen/i });
    fireEvent.click(proposeButton);

    await waitFor(() => expect(cropSpeciesProposeMock).toHaveBeenCalledWith('Kürbis'));
    expect(await screen.findByText(/existiert bereits oder wurde schon vorgeschlagen/)).toBeInTheDocument();
    expect(screen.queryByText(/wurde zur Prüfung eingereicht/)).not.toBeInTheDocument();
  });

  it('pre-selects the existing public variety that already matches the local variety name', async () => {
    publicCultureListMock.mockResolvedValue({
      data: {
        results: [
          { id: 40, status: 'published', name: 'Tomate', display_name: 'Tomate', variety: 'Roma', crop_species: 1, version: 2 },
          { id: 41, status: 'published', name: 'Tomate', display_name: 'Tomate', variety: 'Ochsenherz', crop_species: 1, version: 1 },
        ],
      },
    });

    renderWizard();

    await screen.findByLabelText(/Offizielle Kulturart/i);
    // The species is already selected in the field above, so this field
    // shows only the variety name — not a redundant "Species · Variety".
    await waitFor(() => expect(screen.getByDisplayValue('Roma')).toBeInTheDocument());
  });

  it('shows a link to view foreign duplicates instead of blocking on plain text', async () => {
    publishPreviewMock.mockResolvedValue({
      data: {
        crop_species: { id: 1, name: 'Tomate' },
        original_language_code: 'de',
        available_language_codes: ['de'],
        missing_required_fields: [],
        duplicates: [{ id: 55, name: 'Tomate', variety: 'Roma', version: 1, published_at: null, is_mine: false }],
        can_publish: false,
        general_crop_notice: null,
      },
    });

    renderWizard();
    await screen.findByLabelText(/Offizielle Kulturart/i);

    fireEvent.click(screen.getByRole('button', { name: 'Jetzt veröffentlichen' }));

    const viewLink = await screen.findByRole('link', { name: 'Eintrag ansehen' });
    expect(viewLink).toHaveAttribute('href', '/app/crop-library?cultureId=55');
  });

  it('hides the "Existing variety" field and publishes as general for a crop-level culture (no variety)', async () => {
    const cropLevelCulture: Culture = { ...CULTURE, variety: '' };
    renderWizard(cropLevelCulture);

    await screen.findByLabelText(/Offizielle Kulturart/i);
    expect(screen.queryByLabelText('Vorhandene Sorte')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Jetzt veröffentlichen' }));

    await waitFor(() => expect(publishPreviewMock).toHaveBeenCalledWith(
      cropLevelCulture.id,
      expect.objectContaining({ crop_species_id: 1, original_language_code: 'de', publish_as_general: true }),
    ));
  });

  it('prefills the species field with the local culture name on open, for crop-level and variety cultures', async () => {
    renderWizard();
    expect(await screen.findByDisplayValue('Tomate')).toBeInTheDocument();
  });

  it('keeps "Original language" collapsed to a summary with a change link by default', async () => {
    renderWizard();
    await screen.findByLabelText(/Offizielle Kulturart/i);

    expect(screen.queryByLabelText('Originalsprache')).not.toBeInTheDocument();
    expect(screen.getByText(/Originalsprache: /)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ändern' }));
    expect(screen.getByLabelText('Originalsprache')).toBeInTheDocument();
  });

  it('shows a dismissible notice when the general crop data looks stale', async () => {
    publishPreviewMock.mockResolvedValue({
      data: {
        crop_species: { id: 1, name: 'Tomate' },
        original_language_code: 'de',
        available_language_codes: ['de'],
        missing_required_fields: [],
        duplicates: [],
        can_publish: true,
        general_crop_notice: { public_culture_id: 42, updated_at: '2024-01-01T00:00:00Z', is_stale: true, is_incomplete: false },
      },
    });

    renderWizard();
    await screen.findByLabelText(/Offizielle Kulturart/i);

    fireEvent.click(screen.getByRole('button', { name: 'Jetzt veröffentlichen' }));

    const notice = await screen.findByText(/wurden lange nicht aktualisiert/);
    expect(notice).toBeInTheDocument();
    const editLink = screen.getByRole('link', { name: 'In der Bibliothek bearbeiten' });
    expect(editLink).toHaveAttribute('href', '/app/crop-library?cultureId=42');

    fireEvent.click(screen.getByLabelText(/close/i));
    await waitFor(() => expect(screen.queryByText(/wurden lange nicht aktualisiert/)).not.toBeInTheDocument());
  });
});
