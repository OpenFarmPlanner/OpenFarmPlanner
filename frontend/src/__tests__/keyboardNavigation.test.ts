import { describe, expect, it, vi } from 'vitest';
import {
  focusKeyboardNavigableCell,
  getCellLocationFromDomTarget,
  getHorizontalKeyboardNavigationTarget,
  getKeyboardNavigationTarget,
  getViewModeNavigationRequest,
  getVisibleColumnIndex,
  isCellKeyboardNavigable,
  resolveFocusedCellFromEvent,
  scrollCellIntoView,
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
      getVisibleColumns: vi.fn(() => [{ field: 'name' }, { field: 'width_m' }]),
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

  it('uses local row and column fallbacks when live grid metadata is incomplete during edit mode', () => {
    const row = { id: 5, planting_date: '2026-04-10', area_m2: 2 };
    const api = {
      getAllRowIds: vi.fn(() => [5]),
      getCellParams: vi.fn((id: number, field: string) => ({ id, field, row: undefined })),
      getVisibleColumns: vi.fn(() => [
        { field: 'planting_date', editable: true },
        { field: 'area_m2' },
      ]),
    };

    expect(isCellKeyboardNavigable({
      api,
      columns: [
        { field: 'planting_date', editable: true },
        { field: 'area_m2', editable: true },
      ],
      field: 'area_m2',
      row,
      rowId: 5,
    })).toBe(true);

    expect(getKeyboardNavigationTarget({
      api,
      columns: [
        { field: 'planting_date', editable: true },
        { field: 'area_m2', editable: true },
      ],
      current: { id: 5, field: 'planting_date' },
      direction: 1,
      rows: [row],
    })).toEqual({ id: 5, field: 'area_m2' });
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

describe('scrollCellIntoView', () => {
  // Mirrors MUI's own `scrollToIndexes`, which indexes into the *visible*
  // column definitions: an index that counts hidden columns too silently
  // scrolls to the wrong column and throws once it runs past the visible
  // count. Passing that index used to abort Tab navigation for good (below
  // the `lg` breakpoint the planting plans grid hides both harvest-date
  // columns, so Tab out of "Pflanzdatum" reached "Fläche" and then stopped
  // short of "Pflanzen").
  const createApiWithHiddenColumns = () => {
    const visibleColumns = [
      { field: 'crop' },
      { field: 'planting_date' },
      { field: 'area_m2' },
      { field: 'plants_count' },
    ];
    return {
      visibleColumns,
      getVisibleColumns: vi.fn(() => visibleColumns),
      getRowIndexRelativeToVisibleRows: vi.fn(() => 3),
      scrollToIndexes: vi.fn((indexes: { rowIndex?: number; colIndex?: number }) => {
        if (indexes.colIndex !== undefined) {
          // Throws exactly like MUI does on `visibleColumns[colIndex].computedWidth`.
          expect(visibleColumns[indexes.colIndex]).toBeDefined();
        }
      }),
      setCellFocus: vi.fn(),
    };
  };

  it('resolves the column index against the visible columns, not the hidden ones', () => {
    const api = createApiWithHiddenColumns();

    scrollCellIntoView(api, { id: 10, field: 'plants_count' });

    expect(api.scrollToIndexes).toHaveBeenCalledWith({ rowIndex: 3, colIndex: 3 });
  });

  it('skips the column axis for a hidden field instead of scrolling out of range', () => {
    const api = createApiWithHiddenColumns();

    scrollCellIntoView(api, { id: 10, field: 'harvest_end_date' });

    expect(api.scrollToIndexes).toHaveBeenCalledWith({ rowIndex: 3 });
  });

  it('does not scroll at all when neither axis resolves', () => {
    const api = createApiWithHiddenColumns();
    api.getRowIndexRelativeToVisibleRows.mockReturnValue(-1);

    scrollCellIntoView(api, { id: 999, field: 'harvest_end_date' });

    expect(api.scrollToIndexes).not.toHaveBeenCalled();
  });

  it('keeps focusing a cell behind hidden columns instead of throwing', () => {
    const api = createApiWithHiddenColumns();

    expect(() =>
      focusKeyboardNavigableCell({ api, cell: { id: 10, field: 'plants_count' } }),
    ).not.toThrow();
    expect(api.setCellFocus).toHaveBeenCalledWith(10, 'plants_count');
  });
});

describe('getVisibleColumnIndex', () => {
  const api = {
    getVisibleColumns: vi.fn(() => [{ field: 'name' }, { field: 'area_m2' }]),
  };

  it('returns the index within the visible columns', () => {
    expect(getVisibleColumnIndex(api, 'area_m2')).toBe(1);
  });

  it('returns undefined for a hidden field and for a missing grid API', () => {
    expect(getVisibleColumnIndex(api, 'harvest_date')).toBeUndefined();
    expect(getVisibleColumnIndex(null, 'name')).toBeUndefined();
    expect(getVisibleColumnIndex({}, 'name')).toBeUndefined();
  });
});

describe('getViewModeNavigationRequest', () => {
  it('wraps rows and follows shift for Tab', () => {
    expect(getViewModeNavigationRequest('Tab', false)).toEqual({
      axis: 'horizontal',
      direction: 1,
      wrapRows: true,
    });
    expect(getViewModeNavigationRequest('Tab', true)).toEqual({
      axis: 'horizontal',
      direction: -1,
      wrapRows: true,
    });
  });

  it('maps arrow keys to axis and direction without row wrapping', () => {
    expect(getViewModeNavigationRequest('ArrowRight', false)).toEqual({
      axis: 'horizontal',
      direction: 1,
      wrapRows: false,
    });
    expect(getViewModeNavigationRequest('ArrowLeft', false)).toEqual({
      axis: 'horizontal',
      direction: -1,
      wrapRows: false,
    });
    expect(getViewModeNavigationRequest('ArrowDown', false)).toEqual({
      axis: 'vertical',
      direction: 1,
      wrapRows: false,
    });
    expect(getViewModeNavigationRequest('ArrowUp', false)).toEqual({
      axis: 'vertical',
      direction: -1,
      wrapRows: false,
    });
  });

  it('ignores shift for arrow keys and returns null for other keys', () => {
    expect(getViewModeNavigationRequest('ArrowRight', true)).toEqual({
      axis: 'horizontal',
      direction: 1,
      wrapRows: false,
    });
    expect(getViewModeNavigationRequest('Enter', false)).toBeNull();
    expect(getViewModeNavigationRequest('a', false)).toBeNull();
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
