import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CropDetail } from '../crops/CropDetail';
import type { Crop } from '../api/types';
import i18n from '../i18n/config';

const importedCrop: Crop = {
  id: 1,
  name: 'Salat',
  variety: 'Bijella',
  origin_type: 'imported',
  is_modified_from_source: true,
  growth_duration_days: 45,
  harvest_duration_days: 21,
};

const localCrop: Crop = {
  id: 2,
  name: 'Tomate',
  variety: 'Matina',
  origin_type: 'manual',
  is_modified_from_source: false,
  growth_duration_days: 60,
  harvest_duration_days: 30,
};

const renderDetail = (crop: Crop, extraProps: Record<string, unknown> = {}) =>
  render(
    <CropDetail
      crops={[crop]}
      selectedCropId={crop.id}
      onCropSelect={() => {}}
      onPublishCrop={vi.fn()}
      {...extraProps}
    />,
    { wrapper: MemoryRouter },
  );

describe('CropDetail library badges', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
  });

  it('shows the imported badge for imported crops and no "Lokal" badge for local ones', () => {
    renderDetail(importedCrop);
    expect(screen.getByText('Importiert')).toBeInTheDocument();
    expect(screen.queryByText('Lokal')).not.toBeInTheDocument();
  });

  it('renders neither "Lokal" nor "Importiert" for a locally created crop', () => {
    renderDetail(localCrop);
    expect(screen.queryByText('Lokal')).not.toBeInTheDocument();
    expect(screen.queryByText('Importiert')).not.toBeInTheDocument();
  });

  it('does not render a "Veröffentlicht" badge for an owned published crop', () => {
    renderDetail(
      {
        ...localCrop,
        owned_public_crop_id: 12,
        owned_public_crop_role: 'contributor',
        owned_public_crop_published_at: '2026-03-10T12:00:00Z',
      },
      { publishActionLabel: 'Kulturbibliothek aktualisieren' },
    );
    expect(screen.queryByText('Veröffentlicht')).not.toBeInTheDocument();
    // The publish/update button in the badge row carries the status instead.
    expect(screen.getByRole('button', { name: 'Kulturbibliothek aktualisieren' })).toBeInTheDocument();
  });

  it('shows the publish action as a button in the badge row', () => {
    renderDetail(localCrop);
    expect(screen.getByRole('button', { name: 'Veröffentlichen' })).toBeInTheDocument();
  });

  it('does not render the publish button when no publish handler is wired', () => {
    render(
      <CropDetail crops={[localCrop]} selectedCropId={2} onCropSelect={() => {}} />,
      { wrapper: MemoryRouter },
    );
    expect(screen.queryByRole('button', { name: /Veröffentlichen|Kulturbibliothek aktualisieren/ }))
      .not.toBeInTheDocument();
  });

  const blockedTooltipText =
    'Deine lokale Kopie entspricht der aktuellen öffentlichen Version. Bearbeite sie zuerst lokal, um eine Aktualisierung zu veröffentlichen.';

  const renderBlockedPublish = () =>
    renderDetail(
      {
        ...localCrop,
        owned_public_crop_id: 12,
        owned_public_crop_role: 'contributor',
        public_publish_blocked_reason: 'no_local_changes',
      },
      { publishActionLabel: 'Kulturbibliothek aktualisieren' },
    );

  it('disables the publish button when publishing is blocked', () => {
    renderBlockedPublish();
    expect(screen.getByRole('button', { name: 'Kulturbibliothek aktualisieren' })).toBeDisabled();
  });

  it('shows the blocked reason as a hover tooltip on the disabled publish button', async () => {
    renderBlockedPublish();
    const wrapper = screen.getByRole('button', { name: 'Kulturbibliothek aktualisieren' })
      .parentElement as HTMLElement;

    fireEvent.mouseOver(wrapper);
    expect(await screen.findByRole('tooltip', {}, { timeout: 4000 }))
      .toHaveTextContent(blockedTooltipText);
  });

  it('makes the blocked reason reachable by keyboard on the disabled publish button', () => {
    // A disabled <button> is not focusable, so the tooltip anchor is a
    // focusable wrapper that also carries the reason as its accessible name —
    // keyboard and screen-reader users get the explanation without a pointer.
    renderBlockedPublish();
    const wrapper = screen.getByRole('button', { name: 'Kulturbibliothek aktualisieren' })
      .parentElement as HTMLElement;
    expect(wrapper).toHaveAttribute('tabindex', '0');
    expect(wrapper).toHaveAttribute('aria-label', blockedTooltipText);
  });

  it('shows "Lokal geändert" only for a diverged imported copy the user does not own', () => {
    renderDetail(importedCrop);
    expect(screen.getByText('Lokal geändert')).toBeInTheDocument();
  });

  it('hides "Lokal geändert" once the user owns the linked public entry', () => {
    renderDetail(
      { ...importedCrop, owned_public_crop_id: 12, owned_public_crop_role: 'contributor' },
      { publishActionLabel: 'Kulturbibliothek aktualisieren' },
    );
    expect(screen.queryByText('Lokal geändert')).not.toBeInTheDocument();
  });

  it('hides "Lokal geändert" when the copy matches its import source', () => {
    renderDetail({ ...importedCrop, is_modified_from_source: false });
    expect(screen.queryByText('Lokal geändert')).not.toBeInTheDocument();
  });

  it('shows the imported badge hover tooltip', async () => {
    renderDetail({ ...importedCrop, is_modified_from_source: false });

    fireEvent.mouseOver(screen.getByText('Importiert'));
    expect(await screen.findByRole('tooltip'))
      .toHaveTextContent('Diese Kultur wurde aus der öffentlichen Kulturbibliothek importiert.');
  });

  it('keeps the up-to-date library marker for imported crops', async () => {
    renderDetail({
      ...importedCrop,
      is_modified_from_source: false,
      source_public_crop: 12,
      public_update_available: false,
    });

    fireEvent.mouseOver(screen.getByText('Aktuell'));
    expect(await screen.findByRole('tooltip'))
      .toHaveTextContent('Diese Kultur entspricht dem aktuellen Stand in der Kulturbibliothek.');
  });

  it('opens the imported badge tooltip on touch devices', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      renderDetail(importedCrop);

      fireEvent.touchStart(screen.getByText('Importiert'), {
        touches: [{ identifier: 1, clientX: 10, clientY: 10 }],
      });
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(await screen.findByRole('tooltip'))
        .toHaveTextContent('Diese Kultur wurde aus der öffentlichen Kulturbibliothek importiert.');
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks a variety published under an unreviewed crop species as pending', () => {
    renderDetail({ ...importedCrop, public_crop_species_pending: true });
    expect(screen.getByText('Vorschlag in Prüfung')).toBeInTheDocument();
  });

  it('does not mark a variety whose crop species is already reviewed', () => {
    renderDetail(importedCrop);
    expect(screen.queryByText('Vorschlag in Prüfung')).not.toBeInTheDocument();
  });
});
