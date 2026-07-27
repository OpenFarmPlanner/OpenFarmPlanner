import { describe, it, expect } from 'vitest';
import type { GridApi, GridColDef } from '@mui/x-data-grid';
import {
  mergeVisibleDateEditInputValues,
  readDraftRow,
} from '../components/data-grid/draftRowReaders';

interface TestRow {
  id: number;
  name: string;
  sownAt?: unknown;
  [key: string]: unknown;
}

const columns: GridColDef[] = [
  { field: 'name' },
  { field: 'sownAt', type: 'date' },
];

describe('readDraftRow', () => {
  it('layers in-flight edit values over the base row', () => {
    const api = {
      getRowWithUpdatedValues: (_id: number, field: string) =>
        field === 'name' ? { name: 'edited' } : null,
    } as unknown as GridApi;

    const baseRow: TestRow = { id: 1, name: 'original', sownAt: 'keep' };
    const draft = readDraftRow(api, columns, baseRow, 1);

    expect(draft).toEqual({ id: 1, name: 'edited', sownAt: 'keep' });
    expect(baseRow.name).toBe('original');
  });

  it('ignores updated values that do not own the column field', () => {
    const api = {
      getRowWithUpdatedValues: () => ({ unrelated: 'x' }),
    } as unknown as GridApi;

    const draft = readDraftRow(api, columns, { id: 2, name: 'original' } as TestRow, 2);

    expect(draft).toEqual({ id: 2, name: 'original' });
  });
});

describe('mergeVisibleDateEditInputValues', () => {
  it('returns the draft unchanged when no root element is available', () => {
    const draftRow: TestRow = { id: 1, name: 'x' };
    expect(mergeVisibleDateEditInputValues(null, columns, 1, draftRow)).toBe(draftRow);
  });

  it('merges parsed German date input text for editing date cells', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div role="row" data-id="1">
        <div data-field="sownAt" class="MuiDataGrid-cell--editing">
          <input value="15.03.2026" />
        </div>
      </div>
    `;

    const draft = mergeVisibleDateEditInputValues(
      root,
      columns,
      1,
      { id: 1, name: 'x' } as TestRow,
    );

    expect(draft.sownAt).toBeInstanceOf(Date);
    expect((draft.sownAt as Date).getFullYear()).toBe(2026);
  });

  it('leaves non-date columns and non-editing cells untouched', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div role="row" data-id="1">
        <div data-field="sownAt"><input value="15.03.2026" /></div>
      </div>
    `;

    const draftRow: TestRow = { id: 1, name: 'x', sownAt: 'unchanged' };
    const draft = mergeVisibleDateEditInputValues(root, columns, 1, draftRow);

    expect(draft.sownAt).toBe('unchanged');
  });
});
