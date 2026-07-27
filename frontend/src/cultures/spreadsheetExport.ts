import * as XLSX from 'xlsx';
import type { Culture } from '../api/types';
import { toPortableCulture, slugifyFilenamePart } from './exportUtils';
import { CULTURE_COLUMNS } from './spreadsheetColumns';
import { formatIsoDate } from '../utils/isoDate';

export type SpreadsheetExportFormat = 'xlsx' | 'ods' | 'csv';

const MIME_TYPES: Record<SpreadsheetExportFormat, string> = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  csv: 'text/csv;charset=utf-8',
};

const buildSheetData = (cultures: Culture[]): (string | number | null)[][] => {
  const headers = CULTURE_COLUMNS.map((col) => col.header);
  const rows = cultures.map((culture) => {
    const portable = toPortableCulture(culture) as unknown as Record<string, unknown>;
    return CULTURE_COLUMNS.map((col) => {
      const raw = portable[col.key];
      if (raw === undefined || raw === null) return null;
      if (col.enumExport && typeof raw === 'string') return col.enumExport[raw] ?? raw;
      if (typeof raw === 'number') return raw;
      if (typeof raw === 'boolean') return raw ? 'ja' : 'nein';
      return String(raw);
    });
  });
  return [headers, ...rows];
};

const triggerDownload = (data: Uint8Array | string, filename: string, mimeType: string): void => {
  const blob = new Blob([data as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export const exportCulturesToSpreadsheet = (
  cultures: Culture[],
  format: SpreadsheetExportFormat,
  filename: string,
): void => {
  const sheetData = buildSheetData(cultures);
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  // Set column widths for readability
  worksheet['!cols'] = CULTURE_COLUMNS.map((col) => ({
    wch: Math.min(Math.max(col.header.length + 4, 12), 40),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Kulturen');

  const output = XLSX.write(workbook, { bookType: format, type: 'array' }) as Uint8Array;
  triggerDownload(output, filename, MIME_TYPES[format]);
};

export const buildSpreadsheetFilename = (
  format: SpreadsheetExportFormat,
  scope: 'single' | 'all',
  culture?: Culture,
): string => {
  const ext = format;
  if (scope === 'single' && culture) {
    const supplier = slugifyFilenamePart(culture.supplier?.name ?? culture.seed_supplier ?? '');
    const variety = slugifyFilenamePart(culture.variety ?? '');
    return `kultur_${supplier}_${variety}_${formatIsoDate()}.${ext}`;
  }
  return `kulturen_export_${formatIsoDate()}.${ext}`;
};
