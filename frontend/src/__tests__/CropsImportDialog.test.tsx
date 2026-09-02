import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CropsImportDialog } from '../pages/CropsImportDialog';
import type { CropImportState } from '../pages/useCropImportState';

const t = (key: string): string => key;

const buildState = (overrides: Partial<CropImportState>): CropImportState => ({
  previewCount: 1,
  validCount: 1,
  invalidEntries: [],
  payload: [{ name: 'Carrot' }],
  previewResults: [{ index: 0, status: 'create', import_data: { name: 'Carrot' } }],
  status: 'ready',
  error: null,
  success: null,
  failedEntries: [],
  ...overrides,
});

describe('CropsImportDialog', () => {
  it('disables import start when entries are not importable', () => {
    render(
      <CropsImportDialog
        open
        importState={buildState({ validCount: 0, payload: [] })}
        hasImportableEntries={false}
        confirmUpdates={false}
        onConfirmUpdatesChange={vi.fn()}
        onClose={vi.fn()}
        onImportStart={vi.fn()}
        t={t}
      />,
    );

    expect(screen.getByRole('button', { name: 'import.start' })).toBeDisabled();
  });

  it('propagates update-confirmation checkbox changes', () => {
    const onConfirmUpdatesChange = vi.fn();

    render(
      <CropsImportDialog
        open
        importState={buildState({
          previewResults: [{
            index: 0,
            status: 'update_candidate',
            import_data: { name: 'Carrot' },
            diff: [{ field: 'notes', current: 'old', new: 'new' }],
          }],
        })}
        hasImportableEntries
        confirmUpdates={false}
        onConfirmUpdatesChange={onConfirmUpdatesChange}
        onClose={vi.fn()}
        onImportStart={vi.fn()}
        t={t}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox'));

    expect(onConfirmUpdatesChange).toHaveBeenCalledWith(true);
  });
});
