import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GridCellParams, GridRowModesModel } from '@mui/x-data-grid';
import { useSpreadsheetEditStarter } from '../components/data-grid/keyboardEditing';

interface TestRow {
  id: number;
  name: string;
}

function makeCellParams(field = 'name'): GridCellParams<TestRow> {
  return {
    id: 1,
    field,
    isEditable: true,
    row: { id: 1, name: 'Tomate' },
  } as GridCellParams<TestRow>;
}

function makeKeyEvent(key: string): React.KeyboardEvent {
  return {
    key,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    target: document.createElement('div'),
    nativeEvent: { isComposing: false },
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.KeyboardEvent;
}

function renderStarter(getCellElement: () => HTMLElement | null) {
  const rowModesModel: GridRowModesModel = {};
  return renderHook(() => useSpreadsheetEditStarter<TestRow>({
    apiRef: {
      current: {
        getCellElement,
        isCellEditable: () => true,
        setCellFocus: vi.fn(),
        setEditCellValue: vi.fn(),
      },
    },
    rowModesModel,
    setRowModesModel: vi.fn(),
  }));
}

describe('useSpreadsheetEditStarter focus scheduling', () => {
  it('does not reach for a cell element after the grid unmounted', async () => {
    // Regression test for a CI failure that was not a failing test at all: the
    // focus retry scheduled on setTimeout/requestAnimationFrame outlived the
    // hook, fired after vitest tore the jsdom environment down, and killed the
    // whole run with an unhandled "document is not defined" while all 2025
    // tests reported green.
    const getCellElement = vi.fn(() => {
      const cell = document.createElement('div');
      cell.append(document.createElement('input'));
      return cell;
    });
    const { result, unmount } = renderStarter(getCellElement);

    result.current.startEditFromF2(makeCellParams(), makeKeyEvent('F2'));
    expect(getCellElement).toHaveBeenCalled();

    unmount();
    const callsAtUnmount = getCellElement.mock.calls.length;

    await new Promise((resolve) => { setTimeout(resolve, 20); });

    expect(getCellElement.mock.calls.length).toBe(callsAtUnmount);
  });

  it('drops a superseded focus attempt so it cannot land on the previous cell', async () => {
    const fields: string[] = [];
    // Never resolves to an editor, so every scheduled attempt runs and is
    // counted instead of stopping at the first success.
    const getCellElement = vi.fn((_id: unknown, field: string) => {
      fields.push(field);
      return null;
    });
    const { result, unmount } = renderStarter(getCellElement as never);

    result.current.startEditFromF2(makeCellParams('name'), makeKeyEvent('F2'));
    result.current.startEditFromF2(makeCellParams('variety'), makeKeyEvent('F2'));

    await new Promise((resolve) => { setTimeout(resolve, 20); });

    // The first request keeps its synchronous attempt and its microtask - a
    // microtask cannot be cancelled - but its setTimeout and its frame must be
    // dropped by the second request, or they would pull focus back to 'name'
    // after 'variety' already has it.
    expect(fields.filter((field) => field === 'name')).toHaveLength(2);
    expect(fields.filter((field) => field === 'variety').length).toBeGreaterThan(2);
    unmount();
  });
});
