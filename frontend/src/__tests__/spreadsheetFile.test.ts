import { describe, expect, it } from 'vitest';
import { buildSpreadsheetFile, parseSpreadsheetRows, type SpreadsheetRows } from '../cultures/spreadsheetFile';

const rows: SpreadsheetRows = [
  ['Name', 'Sorte', 'Wachstumszeit', 'Mehrjährig'],
  ['Tomate', 'Roma', 70, false],
  ['Salat', 'Maikönig', 42, true],
];

describe('spreadsheetFile', () => {
  it.each(['csv', 'xlsx', 'ods'] as const)('round-trips %s rows without the xlsx package', (format) => {
    const file = buildSpreadsheetFile(rows, format);
    const buffer = typeof file === 'string'
      ? new TextEncoder().encode(file).buffer
      : file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    const expectedRows = format === 'csv'
      ? [
        ['Name', 'Sorte', 'Wachstumszeit', 'Mehrjährig'],
        ['Tomate', 'Roma', '70', 'nein'],
        ['Salat', 'Maikönig', '42', 'ja'],
      ]
      : rows;

    expect(parseSpreadsheetRows(buffer, format)).toEqual(expectedRows);
  });

  it('reads semicolon-separated CSV files', () => {
    const buffer = new TextEncoder().encode('Name;Sorte;Wachstumszeit\nTomate;Roma;70').buffer;

    expect(parseSpreadsheetRows(buffer, 'csv')).toEqual([
      ['Name', 'Sorte', 'Wachstumszeit'],
      ['Tomate', 'Roma', '70'],
    ]);
  });
});
