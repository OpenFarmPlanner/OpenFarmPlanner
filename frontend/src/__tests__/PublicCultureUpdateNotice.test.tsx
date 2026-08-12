import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicCultureUpdateNotice } from '../cultures/PublicCultureUpdateNotice';
import type { Culture, CulturePublicUpdate } from '../api/types';
import translations from '@/test-utils/translations';

const apiMocks = vi.hoisted(() => ({
  publicUpdate: vi.fn(),
  importToProject: vi.fn(),
}));

vi.mock('../api/api', async () => {
  const actual = await vi.importActual<typeof import('../api/api')>('../api/api');
  return {
    ...actual,
    cultureAPI: { ...actual.cultureAPI, publicUpdate: apiMocks.publicUpdate },
    publicCultureAPI: { ...actual.publicCultureAPI, importToProject: apiMocks.importToProject },
  };
});

const t = translations.cultures.library;

const importedCulture: Culture = {
  id: 7,
  name: 'Karotte',
  variety: 'Nantes',
  origin_type: 'imported',
  public_update_available: true,
};

const varietyRenameUpdate: CulturePublicUpdate = {
  available: true,
  public_culture_id: 42,
  public_culture_name: 'Karotte (Nantes II)',
  public_version: 2,
  local_version: 1,
  has_local_changes: false,
  changes: [
    { field: 'variety', local_value: 'Nantes', public_value: 'Nantes II' },
    { field: 'growth_duration_days', local_value: 70, public_value: 80 },
  ],
};

describe('PublicCultureUpdateNotice', () => {
  beforeEach(() => {
    apiMocks.publicUpdate.mockReset();
    apiMocks.importToProject.mockReset();
  });

  const openDialog = async (update: CulturePublicUpdate = varietyRenameUpdate) => {
    apiMocks.publicUpdate.mockResolvedValue({ data: update });
    const onUpdated = vi.fn();
    render(<PublicCultureUpdateNotice culture={importedCulture} onUpdated={onUpdated} />);
    await userEvent.click(screen.getByRole('button', { name: t.publicUpdate.review }));
    await screen.findByText(t.publicUpdate.dialogTitle);
    return onUpdated;
  };

  it('stays hidden when the copy matches the current library version', () => {
    render(<PublicCultureUpdateNotice culture={{ ...importedCulture, public_update_available: false }} />);

    expect(screen.queryByTestId('culture-public-update-notice')).toBeNull();
    expect(apiMocks.publicUpdate).not.toHaveBeenCalled();
  });

  it('calls out a variety rename explicitly instead of as a generic field row', async () => {
    await openDialog();

    expect(screen.getByTestId('culture-public-update-variety-change'))
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
});
