import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSingleSelectEditCell } from '../components/data-grid/useSingleSelectEditCell';

const options = [
  { value: 'direct_sowing', label: 'Direktsaat' },
  { value: 'pre_cultivation', label: 'Vorkultur' },
];

function setup() {
  const setEditCellValue = vi.fn();
  const { result } = renderHook(() =>
    useSingleSelectEditCell<string>({
      id: 3,
      field: 'cultivation_type',
      api: { setEditCellValue },
      options,
      typeaheadValue: 'direct_sowing',
    }),
  );
  return { result, setEditCellValue };
}

describe('useSingleSelectEditCell', () => {
  it('starts closed and opens through handleOpen', () => {
    const { result } = setup();

    expect(result.current.open).toBe(false);

    act(() => {
      result.current.handleOpen();
    });

    expect(result.current.open).toBe(true);
  });

  it('closes again through handleClose', () => {
    const { result } = setup();

    act(() => {
      result.current.handleOpen();
    });
    expect(result.current.open).toBe(true);

    act(() => {
      result.current.handleClose(new Event('close'));
    });

    expect(result.current.open).toBe(false);
  });

  it('exposes the select and menu keyboard handlers', () => {
    const { result } = setup();

    expect(typeof result.current.handleSelectKeyDown).toBe('function');
    expect(typeof result.current.handleMenuKeyDown).toBe('function');
  });
});
