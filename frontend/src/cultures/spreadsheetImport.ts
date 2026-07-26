// `xlsx` has two open advisories (Prototype Pollution / ReDoS,
// GHSA-4r6h-8v6p-xvw6 and GHSA-5pgg-2g8v-p4x9) with no fix released by
// SheetJS. Accepted as a known risk rather than replaced: this parses a
// file the *authenticated user themselves* uploads, entirely client-side —
// there is no server-side or cross-user exposure. A full replacement isn't
// available either: the accepted import formats include .ods (see
// CulturesImportStartDialog's file input `accept`), which alternatives like
// exceljs don't support, and exceljs's own dependency footprint (archiver,
// unzipper, jszip, ...) would need real browser-bundle verification before
// it could replace even the .xlsx/.csv path. Re-evaluate if SheetJS ships a
// fix or a lighter, ODS-capable alternative appears.
import * as XLSX from 'xlsx';
import { normalizeImportCultureEntry } from './importUtils';
import { buildHeaderToKeyMap, normalizeHeaderForLookup, CULTURE_COLUMNS } from './spreadsheetColumns';

export type SpreadsheetParseResult = {
  entries: Record<string, unknown>[];
  skippedRows: number;
  warnings: string[];
};

const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error('Datei konnte nicht gelesen werden'));
    reader.readAsArrayBuffer(file);
  });

const parseRawValue = (
  value: unknown,
  type: 'string' | 'number' | 'boolean',
  enumImport?: Record<string, string>,
): unknown => {
  if (value === null || value === undefined || value === '') return undefined;

  if (type === 'number') {
    const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
  }

  if (type === 'boolean') {
    const s = String(value).trim().toLowerCase();
    if (s === 'ja' || s === 'yes' || s === '1' || s === 'true') return true;
    if (s === 'nein' || s === 'no' || s === '0' || s === 'false') return false;
    return undefined;
  }

  const s = String(value).trim();
  if (!s) return undefined;

  if (enumImport) {
    const mapped = enumImport[normalizeHeaderForLookup(s)];
    return mapped ?? s;
  }

  return s;
};

export const parseSpreadsheetFile = async (file: File): Promise<SpreadsheetParseResult> => {
  const buffer = await readFileAsArrayBuffer(file);
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { entries: [], skippedRows: 0, warnings: ['Keine Tabelle in der Datei gefunden.'] };
  }
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: null, blankrows: false });

  if (rows.length < 1) {
    return { entries: [], skippedRows: 0, warnings: ['Die Tabelle enthält keine Daten.'] };
  }

  const headerRow = rows[0] as (string | null)[];
  const headerToKey = buildHeaderToKeyMap();
  const columnMap: (string | null)[] = headerRow.map((h) => {
    if (!h) return null;
    return headerToKey.get(normalizeHeaderForLookup(String(h))) ?? null;
  });

  const keyToColDef = new Map(CULTURE_COLUMNS.map((col) => [col.key, col]));

  const warnings: string[] = [];
  const unrecognized = headerRow.filter((h, i) => h && !columnMap[i]);
  if (unrecognized.length > 0) {
    warnings.push(`Nicht erkannte Spalten werden ignoriert: ${unrecognized.filter(Boolean).join(', ')}`);
  }

  const dataRows = rows.slice(1);
  let skippedRows = 0;
  const entries: Record<string, unknown>[] = [];

  for (const rawRow of dataRows) {
    const row = rawRow as (unknown | null)[];
    const entry: Record<string, unknown> = {};

    for (let i = 0; i < columnMap.length; i++) {
      const key = columnMap[i];
      if (!key) continue;
      const colDef = keyToColDef.get(key);
      if (!colDef) continue;
      const raw = i < row.length ? row[i] : null;
      const parsed = parseRawValue(raw, colDef.type, colDef.enumImport);
      if (parsed !== undefined) {
        entry[key] = parsed;
      }
    }

    if (!entry['name']) {
      skippedRows++;
      continue;
    }

    entries.push(normalizeImportCultureEntry(entry));
  }

  return { entries, skippedRows, warnings };
};
