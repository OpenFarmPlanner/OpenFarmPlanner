import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CropDetail } from '../crops/CropDetail';
import type { Crop } from '../api/types';
import i18n from '../i18n/config';

const localCrop: Crop = {
  id: 1,
  name: 'Tomate',
  variety: 'Matina',
  origin_type: 'manual',
  crop_species: 3,
  is_modified_from_source: false,
  growth_duration_days: 60,
  harvest_duration_days: 30,
};

const importedInSync: Crop = {
  id: 2,
  name: 'Salat',
  variety: 'Bijella',
  origin_type: 'imported',
  source_public_crop: 12,
  is_modified_from_source: false,
  public_update_available: false,
  public_publish_blocked_reason: 'no_local_changes',
  growth_duration_days: 45,
  harvest_duration_days: 21,
};

const importedDiverged: Crop = {
  ...importedInSync,
  id: 3,
  is_modified_from_source: true,
  public_update_available: true,
  public_publish_blocked_reason: 'update_pending',
};

const renderDetail = (crop: Crop, { withPublishHandler = true } = {}) =>
  render(
    <CropDetail
      crops={[crop]}
      selectedCropId={crop.id}
      onCropSelect={() => {}}
      onPublishCrop={withPublishHandler ? vi.fn() : undefined}
    />,
    { wrapper: MemoryRouter },
  );

describe('CropDetail library badge row', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
  });

  it('shows the "Importiert" badge only for imported crops', () => {
    renderDetail(importedInSync);
    expect(screen.getByText('Importiert')).toBeInTheDocument();
  });

  it('renders no "Lokal", "Veröffentlicht" or "Lokal geändert" badge and no sync marker', () => {
    renderDetail(importedDiverged);
    expect(screen.queryByText('Lokal')).not.toBeInTheDocument();
    expect(screen.queryByText('Veröffentlicht')).not.toBeInTheDocument();
    expect(screen.queryByText('Lokal geändert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('crop-public-update-marker')).not.toBeInTheDocument();
    expect(screen.queryByTestId('crop-public-update-notice')).not.toBeInTheDocument();
  });

  it('shows the publish action for an unlinked crop', () => {
    renderDetail(localCrop);
    const button = screen.getByRole('button', { name: 'In Bibliothek veröffentlichen' });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('data-action-kind', 'publish');
  });

  it('shows a blue "Kultur aktualisieren" button when the library is ahead', () => {
    renderDetail(importedDiverged);
    const button = screen.getByRole('button', { name: 'Kultur aktualisieren' });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('data-action-kind', 'pullUpdate');
    expect(button.className).toMatch(/MuiButton-(outlined)?[Cc]olorInfo/);
  });

  it('disables the action for a linked crop with nothing to contribute, with a hover + focus tooltip', async () => {
    renderDetail(importedInSync);
    const button = screen.getByRole('button', { name: 'Kulturbibliothek aktualisieren' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('data-action-kind', 'noChanges');

    const wrapper = button.parentElement as HTMLElement;
    expect(wrapper).toHaveAttribute('tabindex', '0');
    expect(wrapper).toHaveAttribute(
      'aria-label',
      'Keine lokalen Änderungen, die noch nicht in der Bibliothek sind.',
    );

    fireEvent.mouseOver(wrapper);
    expect(await screen.findByRole('tooltip', {}, { timeout: 4000 }))
      .toHaveTextContent('Keine lokalen Änderungen, die noch nicht in der Bibliothek sind.');
  });

  it('does not render the action button when no publish handler is wired', () => {
    renderDetail(localCrop, { withPublishHandler: false });
    expect(screen.queryByRole('button', {
      name: /veröffentlichen|aktualisieren/i,
    })).not.toBeInTheDocument();
  });

  it('marks a variety published under an unreviewed crop species as pending', () => {
    renderDetail({ ...importedInSync, public_crop_species_pending: true });
    expect(screen.getByText('Vorschlag in Prüfung')).toBeInTheDocument();
  });

  it('shows the imported badge hover tooltip', async () => {
    renderDetail(importedInSync);
    fireEvent.mouseOver(screen.getByText('Importiert'));
    expect(await screen.findByRole('tooltip', {}, { timeout: 4000 }))
      .toHaveTextContent('Diese Kultur wurde aus der öffentlichen Kulturbibliothek importiert.');
  });
});
