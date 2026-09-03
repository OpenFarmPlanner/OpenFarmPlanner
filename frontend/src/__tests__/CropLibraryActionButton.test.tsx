import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CropLibraryActionButton } from '../crops/CropLibraryActionButton';
import { usePublicCropUpdate } from '../crops/usePublicCropUpdate';
import type { Crop } from '../api/types';
import i18n from '../i18n/config';

const apiMocks = vi.hoisted(() => ({ publicUpdate: vi.fn() }));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    cropAPI: { ...actual.cropAPI, publicUpdate: apiMocks.publicUpdate },
  };
});

function Harness({ crop, onPublish, isPublishing = false }: {
  crop: Crop;
  onPublish: () => void;
  isPublishing?: boolean;
}) {
  const controller = usePublicCropUpdate(crop);
  return (
    <CropLibraryActionButton
      crop={crop}
      controller={controller}
      onPublish={onPublish}
      isPublishing={isPublishing}
    />
  );
}

const baseCrop: Crop = { id: 1, name: 'Tomate', variety: 'Roma', is_modified_from_source: false };

describe('CropLibraryActionButton', () => {
  beforeEach(async () => {
    apiMocks.publicUpdate.mockReset();
    apiMocks.publicUpdate.mockResolvedValue({ data: { available: true, public_crop_id: 9, public_version: 2, changes: [] } });
    await i18n.changeLanguage('de');
  });

  it('opens the publishing wizard for an unlinked crop', () => {
    const onPublish = vi.fn();
    render(<Harness crop={{ ...baseCrop, crop_species: 3 }} onPublish={onPublish} />);

    fireEvent.click(screen.getByRole('button', { name: 'In Bibliothek veröffentlichen' }));
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect(apiMocks.publicUpdate).not.toHaveBeenCalled();
  });

  it('opens the pull diff when the library is ahead', () => {
    render(
      <Harness
        crop={{ ...baseCrop, source_public_crop: 9, public_update_available: true }}
        onPublish={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Kultur aktualisieren' }));
    expect(apiMocks.publicUpdate).toHaveBeenCalledTimes(1);
  });

  it('opens the publishing wizard for a push (own entry with local changes)', () => {
    const onPublish = vi.fn();
    render(
      <Harness
        crop={{
          ...baseCrop,
          owned_public_crop_id: 9,
          owned_public_crop_role: 'contributor',
          public_publish_blocked_reason: null,
        }}
        onPublish={onPublish}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Kulturbibliothek aktualisieren' }));
    expect(onPublish).toHaveBeenCalledTimes(1);
  });

  it('is inert and explains itself when there is nothing to contribute', () => {
    const onPublish = vi.fn();
    render(
      <Harness
        crop={{ ...baseCrop, source_public_crop: 9, public_publish_blocked_reason: 'no_local_changes' }}
        onPublish={onPublish}
      />,
    );

    const button = screen.getByRole('button', { name: 'Kulturbibliothek aktualisieren' });
    expect(button).toBeDisabled();
    fireEvent.mouseDown(button);
    expect(onPublish).not.toHaveBeenCalled();

    const wrapper = button.parentElement as HTMLElement;
    fireEvent.focus(wrapper);
    // The reason is the focusable wrapper's accessible name and the tooltip.
    expect(wrapper).toHaveAttribute(
      'aria-label',
      'Keine lokalen Änderungen, die noch nicht in der Bibliothek sind.',
    );
  });

  it('disables itself with the moderation tooltip while the species is under review', () => {
    render(
      <Harness
        crop={{
          ...baseCrop,
          source_public_crop: 9,
          public_update_available: true,
          public_crop_species_pending: true,
        }}
        onPublish={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: 'Kultur aktualisieren' });
    expect(button).toBeDisabled();
    expect(button.parentElement).toHaveAttribute(
      'aria-label',
      'Diese Funktion ist erst verfügbar, sobald der Kulturart-Vorschlag von einem Moderator geprüft wurde.',
    );
  });

  it('shows a spinner while a push is in flight', () => {
    render(
      <Harness
        crop={{
          ...baseCrop,
          owned_public_crop_id: 9,
          owned_public_crop_role: 'contributor',
          public_publish_blocked_reason: null,
        }}
        onPublish={vi.fn()}
        isPublishing
      />,
    );

    const button = screen.getByRole('button', { name: 'Kulturbibliothek aktualisieren' });
    expect(button).toBeDisabled();
    expect(button.querySelector('.MuiCircularProgress-root')).toBeInTheDocument();
  });
});
