import { describe, expect, it } from 'vitest';
import { GridRowModes } from '@mui/x-data-grid';
import type { GridRowModesModel } from '@mui/x-data-grid';
import {
  collectRowValidationErrors,
  hasInvalidRowInEditMode,
} from '../components/data-grid/rowValidation';

interface TestRow {
  id: number;
  name: string;
  [key: string]: unknown;
}

const rowsById = new Map<string, TestRow>([
  ['1', { id: 1, name: 'valid' }],
  ['2', { id: 2, name: '' }],
]);

const validateRow = (row: TestRow): string | null => (row.name ? null : 'Name required');

describe('hasInvalidRowInEditMode', () => {
  it('returns true when a row in edit mode fails validation', () => {
    const model: GridRowModesModel = { 2: { mode: GridRowModes.Edit } };

    expect(hasInvalidRowInEditMode(model, rowsById, validateRow)).toBe(true);
  });

  it('returns false when only valid rows are in edit mode', () => {
    const model: GridRowModesModel = { 1: { mode: GridRowModes.Edit } };

    expect(hasInvalidRowInEditMode(model, rowsById, validateRow)).toBe(false);
  });

  it('ignores rows that are not in edit mode', () => {
    const model: GridRowModesModel = { 2: { mode: GridRowModes.View } };

    expect(hasInvalidRowInEditMode(model, rowsById, validateRow)).toBe(false);
  });

  it('ignores edit-mode ids that are missing from the row map', () => {
    const model: GridRowModesModel = { 99: { mode: GridRowModes.Edit } };

    expect(hasInvalidRowInEditMode(model, rowsById, validateRow)).toBe(false);
  });
});

describe('collectRowValidationErrors', () => {
  it('keys per-field errors by row id and skips valid rows', () => {
    const rows: TestRow[] = [
      { id: 1, name: 'valid' },
      { id: 2, name: '' },
    ];
    const getRowValidationErrors = (row: TestRow): Record<string, string> =>
      row.name ? {} : { name: 'Name required' };

    expect(collectRowValidationErrors(rows, getRowValidationErrors)).toEqual({
      2: { name: 'Name required' },
    });
  });

  it('returns an empty map when every row is valid', () => {
    const rows: TestRow[] = [{ id: 1, name: 'a' }];

    expect(collectRowValidationErrors(rows, () => ({}))).toEqual({});
  });
});
