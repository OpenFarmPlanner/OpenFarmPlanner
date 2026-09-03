import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

describe('CropDetail library badges', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de');
  });

  it('shows imported and modified badges for imported crops', () => {
    render(
      <CropDetail
        crops={[importedCrop]}
        selectedCropId={1}
        onCropSelect={() => {}}
      />,
      { wrapper: MemoryRouter },
    );

    screen.getByText('Importiert');
    screen.getByText('Lokal geändert');
  });

  it('shows the published badge for a published own public crop', () => {
    render(
      <CropDetail
        crops={[{
          ...importedCrop,
          owned_public_crop_id: 12,
          owned_public_crop_role: 'contributor',
          owned_public_crop_published_at: '2026-03-10T12:00:00Z',
        }]}
        selectedCropId={1}
        onCropSelect={() => {}}
      />,
      { wrapper: MemoryRouter },
    );

    screen.getByText('Importiert');
    screen.getByText('Veröffentlicht');
  });

  it('does not show the published badge when the backend omits the contributor role', () => {
    render(
      <CropDetail
        crops={[{
          ...importedCrop,
          owned_public_crop_id: null,
          owned_public_crop_role: null,
          owned_public_crop_published_at: null,
        }]}
        selectedCropId={1}
        onCropSelect={() => {}}
      />,
      { wrapper: MemoryRouter },
    );

    expect(screen.queryByText('Veröffentlicht')).not.toBeInTheDocument();
  });

  it('shows hover tooltips for imported, up-to-date, and published badges with a localized date', async () => {
    render(
      <CropDetail
        crops={[{
          ...importedCrop,
          is_modified_from_source: false,
          source_public_crop: 12,
          public_update_available: false,
          owned_public_crop_id: 12,
          owned_public_crop_role: 'contributor',
          owned_public_crop_published_at: '2026-03-10T12:00:00Z',
        }]}
        selectedCropId={1}
        onCropSelect={() => {}}
      />,
      { wrapper: MemoryRouter },
    );

    fireEvent.mouseOver(screen.getByText('Importiert'));
    expect(await screen.findByRole('tooltip'))
      .toHaveTextContent('Diese Kultur wurde aus der öffentlichen Kulturbibliothek importiert.');
    fireEvent.mouseLeave(screen.getByText('Importiert'));
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());

    fireEvent.mouseOver(screen.getByText('Aktuell'));
    expect(await screen.findByRole('tooltip'))
      .toHaveTextContent('Diese Kultur entspricht dem aktuellen Stand in der Kulturbibliothek.');
    fireEvent.mouseLeave(screen.getByText('Aktuell'));
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());

    fireEvent.mouseOver(screen.getByText('Veröffentlicht'));
    expect(await screen.findByRole('tooltip'))
      .toHaveTextContent(
        'Diese Kultur wurde von dir am 10.03.2026 in der öffentlichen Kulturbibliothek veröffentlicht.',
      );
  });

  it('opens the imported badge tooltip on touch devices', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(
        <CropDetail
          crops={[importedCrop]}
          selectedCropId={1}
          onCropSelect={() => {}}
        />,
        { wrapper: MemoryRouter },
      );

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

  it('opens the published badge tooltip on touch devices', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(
        <CropDetail
          crops={[{
            ...importedCrop,
            owned_public_crop_id: 12,
            owned_public_crop_role: 'contributor',
            owned_public_crop_published_at: '2026-03-10T12:00:00Z',
          }]}
          selectedCropId={1}
          onCropSelect={() => {}}
        />,
        { wrapper: MemoryRouter },
      );

      fireEvent.touchStart(screen.getByText('Veröffentlicht'), {
        touches: [{ identifier: 1, clientX: 10, clientY: 10 }],
      });
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(await screen.findByRole('tooltip')).toHaveTextContent(
        'Diese Kultur wurde von dir am 10.03.2026 in der öffentlichen Kulturbibliothek veröffentlicht.',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('opens the disabled up-to-date marker tooltip on touch devices', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(
        <CropDetail
          crops={[{
            ...importedCrop,
            source_public_crop: 12,
            public_update_available: false,
          }]}
          selectedCropId={1}
          onCropSelect={() => {}}
        />,
        { wrapper: MemoryRouter },
      );

      fireEvent.touchStart(screen.getByText('Aktuell'), {
        touches: [{ identifier: 1, clientX: 10, clientY: 10 }],
      });
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(await screen.findByRole('tooltip'))
        .toHaveTextContent('Diese Kultur entspricht dem aktuellen Stand in der Kulturbibliothek.');
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks a variety published under an unreviewed crop species as pending', () => {
    render(
      <CropDetail
        crops={[{ ...importedCrop, public_crop_species_pending: true }]}
        selectedCropId={1}
        onCropSelect={() => {}}
      />,
      { wrapper: MemoryRouter },
    );

    screen.getByText('Vorschlag in Prüfung');
  });

  it('does not mark a variety whose crop species is already reviewed', () => {
    render(
      <CropDetail
        crops={[importedCrop]}
        selectedCropId={1}
        onCropSelect={() => {}}
      />,
      { wrapper: MemoryRouter },
    );

    expect(screen.queryByText('Vorschlag in Prüfung')).not.toBeInTheDocument();
  });
});
