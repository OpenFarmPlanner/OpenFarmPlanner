import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildClipboardRowValues,
  buildClipboardTableRows,
  buildTsv,
  copyRowsToClipboard,
  copyTextToClipboardSilently,
  formatClipboardValue,
} from '../components/data-grid/tableClipboard';
import type { EditableDataGridClipboardColumn } from '../components/data-grid/types';
import { GLOBAL_SNACKBAR_EVENT } from '../utils/globalSnackbar';

const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset();
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalClipboardDescriptor) {
    Object.defineProperty(navigator, 'clipboard', originalClipboardDescriptor);
  } else {
    Reflect.deleteProperty(navigator, 'clipboard');
  }
});

describe('table clipboard utilities', () => {
  it('formats rows as sanitized TSV', () => {
    expect(buildTsv([
      ['Name', 'Notes'],
      ['Tomato\tRoma', 'Line\nbreak'],
    ])).toBe('Name\tNotes\nTomato Roma\tLine break');
  });

  it('copies rows and emits a success snackbar', async () => {
    const listener = vi.fn();
    window.addEventListener(GLOBAL_SNACKBAR_EVENT, listener);
    writeText.mockResolvedValue(undefined);

    try {
      await copyRowsToClipboard({
        rows: [['Name', 'Notes'], ['Tomato', 'Ready']],
        successMessage: 'Copied',
        errorMessage: 'Copy failed',
      });
    } finally {
      window.removeEventListener(GLOBAL_SNACKBAR_EVENT, listener);
    }

    expect(writeText).toHaveBeenCalledWith('Name\tNotes\nTomato\tReady');
    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      message: 'Copied',
      severity: 'success',
    });
  });

  it('emits an error snackbar when copying fails', async () => {
    const listener = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Error('Clipboard denied');
    window.addEventListener(GLOBAL_SNACKBAR_EVENT, listener);
    writeText.mockRejectedValue(error);

    try {
      await copyRowsToClipboard({
        rows: [['Name']],
        successMessage: 'Copied',
        errorMessage: 'Copy failed',
        errorLogMessage: 'Custom copy error',
      });
    } finally {
      window.removeEventListener(GLOBAL_SNACKBAR_EVENT, listener);
    }

    expect(consoleError).toHaveBeenCalledWith('Custom copy error', error);
    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      message: 'Copy failed',
      severity: 'error',
    });
  });

  it('copies silent text without snackbar feedback', async () => {
    const listener = vi.fn();
    window.addEventListener(GLOBAL_SNACKBAR_EVENT, listener);
    writeText.mockResolvedValue(undefined);

    try {
      copyTextToClipboardSilently('Tomato / Bed 1');
      await Promise.resolve();
    } finally {
      window.removeEventListener(GLOBAL_SNACKBAR_EVENT, listener);
    }

    expect(writeText).toHaveBeenCalledWith('Tomato / Bed 1');
    expect(listener).not.toHaveBeenCalled();
  });

  it('ignores silent text copy failures without snackbar feedback', async () => {
    const listener = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    window.addEventListener(GLOBAL_SNACKBAR_EVENT, listener);
    writeText.mockRejectedValue(new Error('Clipboard denied'));

    try {
      copyTextToClipboardSilently('Tomato / Bed 1');
      await Promise.resolve();
      await Promise.resolve();
    } finally {
      window.removeEventListener(GLOBAL_SNACKBAR_EVENT, listener);
    }

    expect(consoleError).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });
});

interface ClipboardTestRow {
  id: number;
  name: string;
  count: number;
  [key: string]: unknown;
}

const clipboardColumns: EditableDataGridClipboardColumn<ClipboardTestRow>[] = [
  { field: 'name', headerName: 'Name' },
  { field: 'count', headerName: 'Anzahl' },
  { field: 'label', headerName: 'Label', getValue: (row) => `#${row.id}` },
];

const clipboardRows: ClipboardTestRow[] = [
  { id: 1, name: 'Tomate', count: 3 },
  { id: 2, name: 'Gurke', count: 5 },
];

describe('buildClipboardRowValues', () => {
  it('formats values and honors per-column getValue overrides', () => {
    expect(buildClipboardRowValues(clipboardColumns, clipboardRows[0])).toEqual(['Tomate', '3', '#1']);
  });
});

describe('buildClipboardTableRows', () => {
  it('prepends a header row of column names', () => {
    const table = buildClipboardTableRows(clipboardColumns, clipboardRows);

    expect(table[0]).toEqual(['Name', 'Anzahl', 'Label']);
    expect(table).toHaveLength(clipboardRows.length + 1);
    expect(table[1]).toEqual(['Tomate', '3', '#1']);
    expect(table[2]).toEqual(['Gurke', '5', '#2']);
  });

  it('returns only the header row for an empty data set', () => {
    expect(buildClipboardTableRows(clipboardColumns, [])).toEqual([['Name', 'Anzahl', 'Label']]);
  });
});

describe('formatClipboardValue', () => {
  it('formats dates in German locale and blanks nullish values', () => {
    expect(formatClipboardValue(new Date('2026-03-15'))).toBe('15.3.2026');
    expect(formatClipboardValue(null)).toBe('');
    expect(formatClipboardValue(undefined)).toBe('');
  });
});
