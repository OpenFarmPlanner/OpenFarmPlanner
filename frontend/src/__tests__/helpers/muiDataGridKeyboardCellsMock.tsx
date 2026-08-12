import React from 'react';
import type { GridColDef } from '@mui/x-data-grid';

type MockRow = { id: string | number; [key: string]: unknown };
type CellLocation = { id: string | number; field: string };

/**
 * A mock of `@mui/x-data-grid`'s `<DataGrid>` for keyboard tests: unlike
 * `muiDataGridEscapeFocusMock` (buttons only) it renders each cell as a real
 * focusable `[role="gridcell"][data-field]` element inside a
 * `[role="row"][data-id]`, calls the column's `renderCell` with a live
 * `hasFocus`, and routes keydown through `onCellKeyDown`.
 *
 * That is exactly what `DataGrid.tsx`'s Tab/Shift+Tab navigation and the
 * dialog-edited cells need to be exercised for real: pressing Tab on a focused
 * cell runs the grid's own navigation, which moves DOM focus to the next cell
 * and — for `dialogEditFields` columns — asks that cell to open its editor.
 *
 * `renderCellFields` keeps the mock cheap: only those columns get their real
 * `renderCell`, everything else falls back to plain text, so a page's heavier
 * cell renderers don't have to survive jsdom for an unrelated test.
 */
export function createMuiDataGridKeyboardCellsMock(options: { renderCellFields?: string[] } = {}) {
  const renderCellFields = options.renderCellFields ?? null;
  const GridRowModes = { Edit: 'edit', View: 'view' };
  const GridRowEditStopReasons = {
    rowFocusOut: 'rowFocusOut',
    enterKeyDown: 'enterKeyDown',
    tabKeyDown: 'tabKeyDown',
    escapeKeyDown: 'escapeKeyDown',
  };
  const getMockFilterOperators = () => [{ value: 'contains', getApplyFilterFn: () => () => true }];
  const useGridApiRef = () => React.useRef<Record<string, unknown>>({});

  const DataGrid = (props: {
    apiRef?: { current: Record<string, unknown> | null };
    rows: MockRow[];
    columns: GridColDef[];
    onCellClick?: (
      params: { id: string | number; field: string; isEditable: boolean; row: MockRow },
      event: unknown,
    ) => void;
    onCellKeyDown?: (
      params: { id: string | number; field: string; isEditable: boolean; row: MockRow },
      event: unknown,
    ) => void;
    onRowSelectionModelChange?: (model: { type: string; ids: Set<string | number> }) => void;
    processRowUpdate?: (row: MockRow) => Promise<MockRow> | MockRow;
    onProcessRowUpdateError?: (error: unknown) => void;
    onRowEditStop?: (params: { id: string | number; reason: string }, event: { defaultMuiPrevented: boolean }) => void;
    rowModesModel?: Record<string | number, { mode: string; fieldToFocus?: string }>;
  }) => {
    const {
      apiRef,
      rows,
      columns,
      onCellClick,
      onCellKeyDown,
      onRowSelectionModelChange,
      rowModesModel,
    } = props;
    const [focusedCell, setFocusedCell] = React.useState<CellLocation | null>(null);
    const cellRefs = React.useRef(new Map<string, HTMLDivElement>());
    const appliedFocusRef = React.useRef<string | null>(null);
    const cellKey = (id: string | number, field: string): string => `${String(id)}-${field}`;

    const registerCell = (key: string) => (element: HTMLDivElement | null): void => {
      if (element) {
        cellRefs.current.set(key, element);
      } else {
        cellRefs.current.delete(key);
      }
    };

    React.useLayoutEffect(() => {
      if (!apiRef?.current) {
        return;
      }

      const api = apiRef.current;
      api.state = api.state ?? { focus: { cell: null } };
      api.getVisibleColumns = () => columns;
      api.getAllRowIds = () => rows.map((row) => row.id);
      api.getRow = (id: string | number) => rows.find((row) => String(row.id) === String(id)) ?? null;
      api.getRowWithUpdatedValues = (id: string | number) =>
        rows.find((row) => String(row.id) === String(id)) ?? null;
      api.getRowIndexRelativeToVisibleRows = (id: string | number) =>
        rows.findIndex((row) => String(row.id) === String(id));
      api.getColumnIndexRelativeToVisibleColumns = (field: string) =>
        columns.findIndex((column) => column.field === field);
      api.isCellEditable = (params: { field: string }) =>
        columns.find((column) => column.field === params.field)?.editable !== false;
      api.getCellParams = (id: string | number, field: string) => ({
        id,
        field,
        row: rows.find((row) => String(row.id) === String(id)),
      });
      api.getCellElement = (id: string | number, field: string) =>
        cellRefs.current.get(cellKey(id, field)) ?? null;
      api.scrollToIndexes = () => {};
      api.setEditCellValue = async () => true;
      api.stopRowEditMode = () => {};
      api.setCellFocus = (id: string | number, field: string) => {
        (api.state as { focus: { cell: CellLocation | null } }).focus.cell = { id, field };
        setFocusedCell({ id, field });
      };
    }, [apiRef, columns, rows]);

    // Mirrors MUI: the grid's focus state owns DOM focus, and it is only
    // pushed onto the DOM when the focused cell actually changes — otherwise
    // re-renders would keep yanking focus back out of a cell's own dialog.
    React.useLayoutEffect(() => {
      if (!focusedCell) {
        return;
      }
      const key = cellKey(focusedCell.id, focusedCell.field);
      if (appliedFocusRef.current === key) {
        return;
      }
      appliedFocusRef.current = key;
      cellRefs.current.get(key)?.focus();
    }, [focusedCell]);

    return (
      <div role="grid">
        {rows.map((row) => (
          <div key={row.id} role="row" data-id={String(row.id)} data-testid={`row-${row.id}`}>
            <span data-testid={`mode-${row.id}`}>{rowModesModel?.[row.id]?.mode ?? GridRowModes.View}</span>
            {columns.map((column) => {
              const isFocused = focusedCell?.field === column.field
                && String(focusedCell.id) === String(row.id);
              const params = {
                id: row.id,
                field: column.field,
                isEditable: column.editable !== false,
                row,
              };
              const shouldRenderCell = typeof column.renderCell === 'function'
                && (!renderCellFields || renderCellFields.includes(column.field));

              return (
                <div
                  key={`${row.id}-${column.field}`}
                  ref={registerCell(cellKey(row.id, column.field))}
                  role="gridcell"
                  data-field={column.field}
                  data-testid={`cell-${row.id}-${column.field}`}
                  tabIndex={isFocused ? 0 : -1}
                  onFocus={() => {
                    if (apiRef?.current) {
                      (apiRef.current.state as { focus: { cell: CellLocation | null } }).focus.cell = {
                        id: row.id,
                        field: column.field,
                      };
                    }
                    appliedFocusRef.current = cellKey(row.id, column.field);
                    setFocusedCell({ id: row.id, field: column.field });
                  }}
                  onClick={() => {
                    onRowSelectionModelChange?.({ type: 'include', ids: new Set([row.id]) });
                    onCellClick?.(params, {
                      preventDefault: () => {},
                      stopPropagation: () => {},
                      defaultMuiPrevented: false,
                    });
                  }}
                  onKeyDown={(event) => {
                    onCellKeyDown?.(params, event);
                  }}
                >
                  {shouldRenderCell
                    ? column.renderCell?.({
                      ...params,
                      value: row[column.field],
                      hasFocus: isFocused,
                    } as never)
                    : String(row[column.field] ?? '')}
                </div>
              );
            })}
          </div>
        ))}
        <span data-testid="focused-cell">
          {focusedCell ? `${focusedCell.id}-${focusedCell.field}` : 'none'}
        </span>
      </div>
    );
  };

  return {
    DataGrid,
    GridRowModes,
    GridRowEditStopReasons,
    getGridBooleanOperators: getMockFilterOperators,
    getGridDateOperators: getMockFilterOperators,
    getGridNumericOperators: getMockFilterOperators,
    getGridSingleSelectOperators: getMockFilterOperators,
    getGridStringOperators: getMockFilterOperators,
    useGridApiRef,
  };
}
