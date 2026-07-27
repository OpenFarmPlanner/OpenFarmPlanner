import { describe, expect, it, vi } from 'vitest';
import {
  focusKeyboardNavigableCell,
  getCellLocationFromDomTarget,
  getHorizontalKeyboardNavigationTarget,
  resolveFocusedCellFromEvent,
} from '../components/data-grid/keyboardNavigation';

function buildGridCell(rowId: string, field: string): HTMLElement {
  const row = document.createElement('div');
  row.setAttribute('role', 'row');
  row.dataset.id = rowId;
  const cell = document.createElement('div');
  cell.setAttribute('role', 'gridcell');
  cell.dataset.field = field;
  row.append(cell);
  return cell;
}

describe('keyboardNavigation', () => {
  it('focuses the edit input inside a focused editable cell', () => {
    const cellElement = document.createElement('div');
    const input = document.createElement('input');
    cellElement.append(input);
    document.body.append(cellElement);

    const api = {
      getCellElement: vi.fn(() => cellElement),
      getColumnIndexRelativeToVisibleColumns: vi.fn(() => 1),
      getRowIndexRelativeToVisibleRows: vi.fn(() => 0),
      scrollToIndexes: vi.fn(),
      setCellFocus: vi.fn(),
    };

    focusKeyboardNavigableCell({
      api,
      cell: { id: 1, field: 'width_m' },
      focusEditInput: true,
    });

    expect(api.scrollToIndexes).toHaveBeenCalledWith({ rowIndex: 0, colIndex: 1 });
    expect(api.setCellFocus).toHaveBeenCalledWith(1, 'width_m');
    expect(document.activeElement).toBe(input);

    cellElement.remove();
  });
});

describe('getCellLocationFromDomTarget', () => {
  it('resolves a cell and parses a numeric row id', () => {
    const cell = buildGridCell('42', 'name');

    expect(getCellLocationFromDomTarget(cell)).toEqual({ id: 42, field: 'name' });
  });

  it('keeps a non-numeric row id as a string', () => {
    const cell = buildGridCell('draft-1', 'name');

    expect(getCellLocationFromDomTarget(cell)).toEqual({ id: 'draft-1', field: 'name' });
  });

  it('returns null for targets outside a grid cell', () => {
    expect(getCellLocationFromDomTarget(null)).toBeNull();
    expect(getCellLocationFromDomTarget(document.createElement('span'))).toBeNull();
  });
});

describe('getHorizontalKeyboardNavigationTarget', () => {
  const fields = ['name', 'width_m', 'notes'];

  it('moves to the next field when navigating forward', () => {
    expect(getHorizontalKeyboardNavigationTarget(fields, 5, 'name', 1)).toEqual({
      id: 5,
      field: 'width_m',
    });
  });

  it('moves to the previous field when navigating backward', () => {
    expect(getHorizontalKeyboardNavigationTarget(fields, 5, 'width_m', -1)).toEqual({
      id: 5,
      field: 'name',
    });
  });

  it('returns null at the row edges', () => {
    expect(getHorizontalKeyboardNavigationTarget(fields, 5, 'notes', 1)).toBeNull();
    expect(getHorizontalKeyboardNavigationTarget(fields, 5, 'name', -1)).toBeNull();
  });

  it('returns null when the current field is not navigable', () => {
    expect(getHorizontalKeyboardNavigationTarget(fields, 5, 'unknown', 1)).toBeNull();
  });
});

describe('resolveFocusedCellFromEvent', () => {
  it('prefers the grid focus state when a cell is tracked', () => {
    const api = { state: { focus: { cell: { id: 7, field: 'width_m' } } } };

    const result = resolveFocusedCellFromEvent(api, { target: null });

    expect(result).toEqual({ id: 7, field: 'width_m' });
  });

  it('falls back to the event target DOM when no cell is tracked', () => {
    const cell = buildGridCell('42', 'name');

    expect(resolveFocusedCellFromEvent(null, { target: cell })).toEqual({
      id: 42,
      field: 'name',
    });
  });

  it('returns null when the target is not resolvable to a cell', () => {
    expect(resolveFocusedCellFromEvent(null, { target: null })).toBeNull();
    expect(
      resolveFocusedCellFromEvent(undefined, { target: document.createElement('span') }),
    ).toBeNull();
  });
});
