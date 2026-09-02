import { describe, expect, it } from 'vitest';
import { normalizeImportCropEntry, parseCropImportJson } from '../crops/importUtils';

describe('crop import utils', () => {
  it('parses new single-crop export envelope and maps supplierName', () => {
    const parsed = parseCropImportJson(JSON.stringify({
      schemaVersion: 1,
      exportedAt: '2026-02-24',
      type: 'crop',
      crop: {
        name: 'Tomate',
        variety: 'Roma',
        supplierName: 'Bingenheimer',
        growth_duration_days: 80,
        harvest_duration_days: 20,
      },
    }));

    expect(parsed.originalCount).toBe(1);
    expect(parsed.entries[0]).toMatchObject({
      name: 'Tomate',
      variety: 'Roma',
      supplier_name: 'Bingenheimer',
    });
    expect(parsed.entries[0]).not.toHaveProperty('supplierName');
  });

  it('supports legacy array format and converts meter fields to centimeters', () => {
    const entry = normalizeImportCropEntry({
      name: 'Bohne',
      variety: 'Faraday',
      seed_supplier: 'ReinSaat',
      distance_within_row_m: 0.3,
      row_spacing_m: 0.4,
      sowing_depth_m: 0.005,
    });

    expect(entry).toMatchObject({
      supplier_name: 'ReinSaat',
      distance_within_row_cm: 30,
      row_spacing_cm: 40,
      sowing_depth_cm: 0.5,
    });
    expect(entry).not.toHaveProperty('distance_within_row_m');
    expect(entry).not.toHaveProperty('row_spacing_m');
    expect(entry).not.toHaveProperty('sowing_depth_m');
  });
});
