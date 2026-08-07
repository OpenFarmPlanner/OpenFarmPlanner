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

  it('offers an inline crop species proposal when the search has no matches', async () => {
    cropSpeciesListMock.mockResolvedValue({ data: { count: 0, next: null, previous: null, results: [] } });

    renderWizard();

    const speciesInput = await screen.findByLabelText(/Offizielle Kulturart/i);
    const user = userEvent.setup();
    await user.type(speciesInput, 'Kürbis');

    const proposeButton = await screen.findByRole('button', { name: /Kürbis.*als neue Kulturart vorschlagen/i });
    fireEvent.click(proposeButton);

    await waitFor(() => expect(cropSpeciesProposeMock).toHaveBeenCalledWith('Kürbis'));
    expect(await screen.findByText('Der Vorschlag wurde gespeichert und kann später geprüft werden.')).toBeInTheDocument();
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
