import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { CulturesPublishingWizardDialog } from '../pages/CulturesPublishingWizardDialog';
import type { Culture, PublicCulture } from '../api/types';

const {
  cropSpeciesListMock,
  cropSpeciesProposeMock,
  publicCultureListMock,
  publicCultureGetMock,
  publishPreviewMock,
} = vi.hoisted(() => ({
  cropSpeciesListMock: vi.fn(),
  cropSpeciesProposeMock: vi.fn(),
  publicCultureListMock: vi.fn(),
  publicCultureGetMock: vi.fn(),
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
      get: publicCultureGetMock,
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
    publicCultureGetMock.mockReset();
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

  it('submits the species proposal together with the publication, not when the option is picked', async () => {
    cropSpeciesListMock.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });

    renderWizard();

    const speciesInput = await screen.findByLabelText(/Offizielle Kulturart/i);
    const user = userEvent.setup();
    await user.type(speciesInput, 'Kürbis');

    const proposeOption = await screen.findByRole('option', { name: /Kürbis.*als neue Kulturart vorschlagen/i });
    fireEvent.click(proposeOption);

    // Picking the option only arms the dialog: no request yet, the typed text
    // stays in the field, and the main button explains what will happen.
    expect(cropSpeciesProposeMock).not.toHaveBeenCalled();
    expect(await screen.findByDisplayValue('Kürbis')).toBeInTheDocument();
    expect(screen.getByText(/Deine Sorte wird vorläufig unter „Kürbis“ veröffentlicht/)).toBeInTheDocument();

    const proposeButton = screen.getByRole('button', { name: 'Kulturart vorschlagen' });
    expect(proposeButton).toBeEnabled();
    fireEvent.click(proposeButton);

    await waitFor(() => expect(cropSpeciesProposeMock).toHaveBeenCalledWith('Kürbis'));
    // The freshly proposed (pending) species is used for this publication
    // right away instead of blocking the user until a moderator reviews it.
    await waitFor(() => expect(publishPreviewMock).toHaveBeenCalledWith(
      CULTURE.id,
      expect.objectContaining({ crop_species_id: 2 }),
    ));
    expect(await screen.findByText(/Dein Vorschlag für die neue Kulturart „Kürbis“ wurde zur Prüfung eingereicht/)).toBeInTheDocument();
  });

  it('keeps showing the proposed name after picking it while an existing species was already selected', async () => {
    // Regression test: the culture's name ("Tomate") matches an existing
    // species in the default beforeEach mock, so the Autocomplete's
    // `selectedSpecies` (its controlled `value`) starts out as that real
    // CropSpecies, not null. Retyping a different name and picking "propose
    // as new species" clears `selectedSpecies` to null, which is a genuine
    // value change — unlike the case where nothing was ever selected — and
    // is what triggers MUI's internal input-value reset. The field must
    // still show the proposed name afterward, not go blank.
    renderWizard();

    const speciesInput = await screen.findByLabelText(/Offizielle Kulturart/i);
    await waitFor(() => expect(speciesInput).toHaveValue('Tomate'));

    const user = userEvent.setup();
    await user.clear(speciesInput);
    await user.type(speciesInput, 'Ackerbohne test');

    const proposeOption = await screen.findByRole('option', { name: /Ackerbohne test.*als neue Kulturart vorschlagen/i });
    fireEvent.click(proposeOption);

    expect(await screen.findByDisplayValue('Ackerbohne test')).toBeInTheDocument();
    expect(screen.getByText(/Deine Sorte wird vorläufig unter „Ackerbohne test“ veröffentlicht/)).toBeInTheDocument();

    // Switching back to an existing species afterward must not leave any
    // stale "propose" state behind.
    await user.clear(speciesInput);
    await user.type(speciesInput, 'Tomate');
    const tomatoOption = await screen.findByRole('option', { name: 'Tomate' });
    fireEvent.click(tomatoOption);

    expect(await screen.findByDisplayValue('Tomate')).toBeInTheDocument();
    expect(screen.queryByText(/Deine Sorte wird vorläufig unter/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jetzt veröffentlichen' })).toBeInTheDocument();
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
  });

  it('keeps the "propose a new crop species" entry as the last option even when the search matches', async () => {
    cropSpeciesListMock.mockResolvedValue({
      data: {
        count: 2,
        next: null,
        previous: null,
        results: [
          { id: 9, name: 'Pumpkin', display_name: 'Kürbis', status: 'published' },
          { id: 10, name: 'Butternut squash', display_name: 'Kürbis Butternut', status: 'published' },
        ],
      },
    });

    renderWizard();

    const speciesInput = await screen.findByLabelText(/Offizielle Kulturart/i);
    const user = userEvent.setup();
    await user.clear(speciesInput);
    await user.type(speciesInput, 'Kürb');

    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Kürbis',
      'Kürbis Butternut',
      '„Kürb“ als neue Kulturart vorschlagen',
    ]);
  });

  it('hides the proposal entry while the species field is empty', async () => {
    renderWizard();

    const speciesInput = await screen.findByLabelText(/Offizielle Kulturart/i);
    const user = userEvent.setup();
    await user.clear(speciesInput);
    await user.click(speciesInput);

    expect(screen.queryByRole('option', { name: /als neue Kulturart vorschlagen/i })).not.toBeInTheDocument();
  });

  it('hides the proposal entry when the typed text already names an existing species', async () => {
    // Proposing an exact duplicate can only be rejected server-side, so the
    // escape hatch disappears once the typed name *is* an existing one —
    // case-insensitively, since that is how the backend compares.
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
    await user.type(speciesInput, 'kürbis');

    expect(await screen.findByRole('option', { name: 'Kürbis' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /als neue Kulturart vorschlagen/i })).not.toBeInTheDocument();
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

    const proposeOption = await screen.findByRole('option', { name: /Kürbis.*als neue Kulturart vorschlagen/i });
    fireEvent.click(proposeOption);
    fireEvent.click(await screen.findByRole('button', { name: 'Kulturart vorschlagen' }));

    await waitFor(() => expect(cropSpeciesProposeMock).toHaveBeenCalledWith('Kürbis'));
    expect(await screen.findByText(/existiert bereits oder wurde schon vorgeschlagen/)).toBeInTheDocument();
    expect(screen.queryByText(/wurde zur Prüfung eingereicht/)).not.toBeInTheDocument();
    // A failed proposal must not publish the variety under a species that
    // does not exist.
    expect(publishPreviewMock).not.toHaveBeenCalled();
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

  it('publishes as general when updating an already-linked public entry that has no variety', async () => {
    const linkedPublicCulture: PublicCulture = {
      id: 55,
      status: 'published',
      name: 'Bohne',
      variety: '',
      crop_species: 1,
      thousand_kernel_weight_g: 400,
      version: 1,
    };
    publicCultureGetMock.mockResolvedValue({ data: linkedPublicCulture });
    const ownedGeneralCulture: Culture = {
      ...CULTURE,
      variety: '',
      owned_public_culture_id: 55,
      thousand_kernel_weight_g: 472,
    };

    renderWizard(ownedGeneralCulture);

    await waitFor(() => expect(publicCultureGetMock).toHaveBeenCalledWith(55));
    const updateButton = await screen.findByRole('button', { name: 'Öffentliche Version aktualisieren' });
    await waitFor(() => expect(updateButton).toBeEnabled());

    fireEvent.click(updateButton);

    await waitFor(() => expect(publishPreviewMock).toHaveBeenCalledWith(
      ownedGeneralCulture.id,
      expect.objectContaining({ publish_as_general: true }),
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
