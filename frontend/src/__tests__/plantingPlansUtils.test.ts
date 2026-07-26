import { describe, expect, it } from 'vitest';
import {
  getAllowedCultivationTypesForCulture,
  isEmptyNewPlantingPlanRow,
  type PlantingPlanRow,
} from '../pages/plantingPlansUtils';

describe('getAllowedCultivationTypesForCulture', () => {
  it('returns only allowed values from cultivation_types', () => {
    const options = getAllowedCultivationTypesForCulture({
      cultivation_types: ['direct_sowing'],
    } as never);

    expect(options).toEqual(['direct_sowing']);
  });

  it('falls back to cultivation_type if cultivation_types is missing', () => {
    const options = getAllowedCultivationTypesForCulture({
      cultivation_type: 'pre_cultivation',
    } as never);

    expect(options).toEqual(['pre_cultivation']);
  });

  it('falls back to both options when culture does not define restrictions', () => {
    const options = getAllowedCultivationTypesForCulture(undefined);

    expect(options).toEqual(['direct_sowing', 'pre_cultivation']);
  });
});

describe('isEmptyNewPlantingPlanRow', () => {
  const emptyRow: PlantingPlanRow = {
    id: -1,
    isNew: true,
    culture: 0,
    bed: 0,
    location_id: undefined,
    field_id: undefined,
    cultivation_type: '',
    planting_date: '',
    quantity: undefined,
    area_m2: undefined,
    plants_count: undefined,
    notes: '',
    note_attachment_count: 0,
  } as PlantingPlanRow;

  it('treats a default new planting plan row as empty', () => {
    expect(isEmptyNewPlantingPlanRow(emptyRow)).toBe(true);
  });

  it('treats selected culture or bed values as user input', () => {
    expect(isEmptyNewPlantingPlanRow({ ...emptyRow, culture: 12 })).toBe(false);
    expect(isEmptyNewPlantingPlanRow({ ...emptyRow, bed: 34 })).toBe(false);
  });

  it('treats entered free-form values as user input', () => {
    expect(isEmptyNewPlantingPlanRow({ ...emptyRow, cultivation_type: 'direct_sowing' })).toBe(false);
    expect(isEmptyNewPlantingPlanRow({ ...emptyRow, planting_date: new Date('2026-04-01') as never })).toBe(false);
    expect(isEmptyNewPlantingPlanRow({ ...emptyRow, notes: 'Needs shade' })).toBe(false);
    expect(isEmptyNewPlantingPlanRow({ ...emptyRow, area_m2: 2.5 })).toBe(false);
    expect(isEmptyNewPlantingPlanRow({ ...emptyRow, area_m2: 'max' as never })).toBe(false);
  });
});
