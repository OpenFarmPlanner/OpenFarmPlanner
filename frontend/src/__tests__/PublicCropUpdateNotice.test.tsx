import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicCropUpdateNotice } from '../crops/PublicCropUpdateNotice';
import { PublicCropUpdateMarker } from '../crops/PublicCropUpdateMarker';
import { usePublicCropUpdate } from '../crops/usePublicCropUpdate';
import type { Crop, CropPublicUpdate } from '../api/types';
import translations from '@/test-utils/translations';

const apiMocks = vi.hoisted(() => ({
  publicUpdate: vi.fn(),
  rejectPublicUpdate: vi.fn(),
  importToProject: vi.fn(),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    cropAPI: {
      ...actual.cropAPI,
      publicUpdate: apiMocks.publicUpdate,
      rejectPublicUpdate: apiMocks.rejectPublicUpdate,
    },
    publicCropAPI: { ...actual.publicCropAPI, importToProject: apiMocks.importToProject },
  };
});

const t = translations.crops.library;

const importedCrop: Crop = {
  id: 7,
  name: 'Karotte',
  variety: 'Nantes',
  origin_type: 'imported',
  source_public_crop: 42,
  public_update_available: true,
};

const varietyRenameUpdate: CropPublicUpdate = {
  available: true,
  public_crop_id: 42,
  public_crop_name: 'Karotte (Nantes II)',
  public_version: 2,
  local_version: 1,
  has_local_changes: false,
  changes: [
    { field: 'variety', local_value: 'Nantes', public_value: 'Nantes II' },
    { field: 'growth_duration_days', local_value: 70, public_value: 80 },
  ],
};

/** Mirrors how CropDetail wires the shared controller into both entry points. */
function UpdateHarness({ crop, onUpdated, disabledReason }: {
  crop: Crop;
  onUpdated?: () => void;
  disabledReason?: string;
}) {
  const controller = usePublicCropUpdate(crop, onUpdated);
  return (
    <>
      <PublicCropUpdateMarker controller={controller} disabledReason={disabledReason} />
      <PublicCropUpdateNotice crop={crop} controller={controller} disabledReason={disabledReason} />
    </>
  );
}

describe('PublicCropUpdateNotice', () => {
  beforeEach(() => {
    apiMocks.publicUpdate.mockReset();
    apiMocks.rejectPublicUpdate.mockReset();
    apiMocks.importToProject.mockReset();
  });

  const openDialog = async (
    update: CropPublicUpdate = varietyRenameUpdate,
    crop: Crop = importedCrop,
  ) => {
    apiMocks.publicUpdate.mockResolvedValue({ data: update });
    const onUpdated = vi.fn();
    render(<UpdateHarness crop={crop} onUpdated={onUpdated} />);
    await userEvent.click(screen.getByRole('button', { name: t.publicUpdate.review }));
    await screen.findByText(t.publicUpdate.dialogTitle);
    return onUpdated;
  };

  it('stays hidden entirely when the crop is not linked to a library entry', () => {
    render(<UpdateHarness crop={{
      ...importedCrop,
      source_public_crop: null,
      public_update_available: false,
    }}
    />);

    expect(screen.queryByTestId('crop-public-update-notice')).toBeNull();
    expect(screen.queryByTestId('crop-public-update-marker')).toBeNull();
    expect(apiMocks.publicUpdate).not.toHaveBeenCalled();
  });

  it('shows a disabled, tooltipped marker when a linked copy already matches the library version', () => {
    render(<UpdateHarness crop={{ ...importedCrop, public_update_available: false }} />);

    expect(screen.queryByTestId('crop-public-update-notice')).toBeNull();
    const marker = screen.getByTestId('crop-public-update-marker');
    expect(marker).toHaveTextContent(t.publicUpdate.markerUpToDateLabel);
    expect(marker).toHaveClass('Mui-disabled');
    expect(apiMocks.publicUpdate).not.toHaveBeenCalled();
  });

  it('calls out a variety rename explicitly instead of as a generic field row', async () => {
    await openDialog();

    expect(screen.getByTestId('crop-public-update-variety-change'))
      .toHaveTextContent('Sortenname geändert: „Nantes“ → „Nantes II“');
    // Other changed fields stay in the plain comparison table.
    expect(screen.getByText(t.publishWizard.comparison.fields.growth_duration_days)).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
  });

  it('applies nothing until the user confirms', async () => {
    const onUpdated = await openDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    await waitFor(() => expect(screen.queryByText(t.publicUpdate.dialogTitle)).toBeNull());
    expect(apiMocks.importToProject).not.toHaveBeenCalled();
    expect(apiMocks.rejectPublicUpdate).not.toHaveBeenCalled();
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('applies the update through the shared import/update model once confirmed', async () => {
    apiMocks.importToProject.mockResolvedValue({ data: { operation: 'updated' } });
    const onUpdated = await openDialog();

    await userEvent.click(screen.getByRole('button', { name: t.publicUpdate.apply }));

    await waitFor(() => expect(apiMocks.importToProject).toHaveBeenCalledWith(42, 'update'));
    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
  });

  it('warns that local edits are replaced when the copy was modified', async () => {
    await openDialog({ ...varietyRenameUpdate, has_local_changes: true });

    expect(screen.getByText(t.importConflictDialog.updateWarning)).toBeInTheDocument();
  });

  it('states plainly when a version bump changed none of the crop data', async () => {
    await openDialog({
      ...varietyRenameUpdate,
      has_local_changes: true,
      changes: [],
    });

    expect(screen.getByTestId('crop-public-update-no-field-changes'))
      .toHaveTextContent(t.publicUpdate.noFieldChanges);
    expect(screen.queryByLabelText(t.publicUpdate.changesAriaLabel)).not.toBeInTheDocument();
    // Nothing is actually overwritten, so the "local edits will be lost"
    // warning must not fire.
    expect(screen.queryByText(t.importConflictDialog.updateWarning)).not.toBeInTheDocument();
  });

  it('records a rejection without copying anything into the local crop', async () => {
    apiMocks.rejectPublicUpdate.mockResolvedValue({ data: {} });
    const onUpdated = await openDialog();

    await userEvent.click(screen.getByRole('button', { name: t.publicUpdate.reject }));

    await waitFor(() => expect(apiMocks.rejectPublicUpdate).toHaveBeenCalledWith(7));
    expect(apiMocks.importToProject).not.toHaveBeenCalled();
    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText(t.publicUpdate.dialogTitle)).toBeNull());
  });

  it('keeps the diff reachable through the permanent marker after a rejection', async () => {
    const rejectedCrop: Crop = {
      ...importedCrop,
      public_update_available: false,
      public_update_rejected: true,
    };
    apiMocks.publicUpdate.mockResolvedValue({ data: { ...varietyRenameUpdate, is_rejected: true } });
    render(<UpdateHarness crop={rejectedCrop} />);

    // The banner is gone, but the decision stays reversible from the marker.
    expect(screen.queryByTestId('crop-public-update-notice')).toBeNull();
    await userEvent.click(screen.getByTestId('crop-public-update-marker'));

    await screen.findByText(t.publicUpdate.dialogTitle);
    expect(screen.getByTestId('crop-public-update-rejected-hint')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.publicUpdate.reject })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.publicUpdate.apply })).toBeEnabled();
  });
  it('blocks both entry points while the crop species is still awaiting moderation', () => {
    render(<UpdateHarness crop={importedCrop} disabledReason={t.badges.speciesPendingTooltip} />);

    expect(screen.getByRole('button', { name: t.publicUpdate.review })).toBeDisabled();
    // Disabled MUI chips drop pointer events entirely, so the diff cannot be
    // opened from the marker either.
    expect(screen.getByTestId('crop-public-update-marker')).toHaveClass('Mui-disabled');
    expect(apiMocks.publicUpdate).not.toHaveBeenCalled();
    expect(screen.queryByText(t.publicUpdate.dialogTitle)).toBeNull();
  });
});
