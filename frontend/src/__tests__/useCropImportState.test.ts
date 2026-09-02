import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCropImportState } from '../pages/useCropImportState';

describe('useCropImportState', () => {
  it('starts with empty idle state', () => {
    const { result } = renderHook(() => useCropImportState());

    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.previewCount).toBe(0);
    expect(result.current.hasImportableEntries).toBe(false);
  });

  it('handles preview ready -> uploading -> partial failure transitions', () => {
    const { result } = renderHook(() => useCropImportState());

    act(() => {
      result.current.setPreviewReadyState({
        previewCount: 5,
        validCount: 3,
        invalidEntries: ['Invalid 1'],
        payload: [{ name: 'Carrot' }, { name: 'Lettuce' }, { name: 'Radish' }],
        previewResults: [{
          index: 0,
          status: 'create',
          import_data: { name: 'Carrot' },
        }],
      });
    });

    expect(result.current.state.status).toBe('ready');
    expect(result.current.hasImportableEntries).toBe(true);

    act(() => {
      result.current.setUploading();
    });

    expect(result.current.state.status).toBe('uploading');
    expect(result.current.state.error).toBeNull();

    act(() => {
      result.current.setPartialFailure({
        error: 'Some items failed',
        failedEntries: [{ index: 1, error: 'duplicate' }],
      });
    });

    expect(result.current.state.status).toBe('error');
    expect(result.current.state.failedEntries).toHaveLength(1);
    expect(result.current.state.error).toBe('Some items failed');
  });

  it('resets state after success', () => {
    const { result } = renderHook(() => useCropImportState());

    act(() => {
      result.current.setPreviewReadyState({
        previewCount: 1,
        validCount: 1,
        invalidEntries: [],
        payload: [{ name: 'Bean' }],
        previewResults: [{
          index: 0,
          status: 'create',
          import_data: { name: 'Bean' },
        }],
      });
      result.current.setSuccessState('Imported');
    });

    expect(result.current.state.status).toBe('success');
    expect(result.current.state.success).toBe('Imported');

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.status).toBe('idle');
    expect(result.current.state.previewResults).toEqual([]);
    expect(result.current.hasImportableEntries).toBe(false);
  });
});
