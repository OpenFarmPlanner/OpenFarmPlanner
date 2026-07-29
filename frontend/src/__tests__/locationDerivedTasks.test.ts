import { describe, expect, it } from 'vitest';
import type { Bed, Culture, Field, Location, PlantingPlan } from '../api/types';
import { deriveLocationTasks } from '../pages/locationDerivedTasks';

const locations: Location[] = [{ id: 1, name: 'Hof Nord' }];
const fields: Field[] = [{ id: 10, name: 'Parzelle A', location: 1 }];
const beds: Bed[] = [{ id: 100, name: 'Beet 1', field: 10 }];

describe('deriveLocationTasks', () => {
  it('derives sowing and harvest tasks for direct sowing plans', () => {
    const cultures: Culture[] = [
      { id: 5, name: 'Karotte', cultivation_types: ['direct_sowing'], growth_duration_days: 60 },
    ];
    const plans: PlantingPlan[] = [
      { id: 99, culture: 5, bed: 100, planting_date: '2026-04-12', cultivation_type: 'direct_sowing' },
    ];

    const tasks = deriveLocationTasks({
      locations,
      fields,
      beds,
      plantingPlans: plans,
      cultures,
      today: new Date('2026-04-01'),
    });

    expect(tasks[1].map((task) => task.type)).toEqual(['sowing', 'harvestStart']);
    expect(tasks[1][0].date).toBe('2026-04-12');
    expect(tasks[1][1].date).toBe('2026-06-11');
  });

  it('derives planting and propagation-start tasks for pre-cultivation', () => {
    const cultures: Culture[] = [
      { id: 6, name: 'Salat', cultivation_types: ['pre_cultivation'], propagation_duration_days: 21, growth_duration_days: 35 },
    ];
    const plans: PlantingPlan[] = [
      { id: 1000, culture: 6, bed: 100, planting_date: '2026-05-03', cultivation_type: 'pre_cultivation' },
    ];

    const tasks = deriveLocationTasks({
      locations,
      fields,
      beds,
      plantingPlans: plans,
      cultures,
      today: new Date('2026-04-01'),
    });

    expect(tasks[1].map((task) => task.type)).toEqual([
      'propagationStart',
      'planting',
      'harvestStart',
    ]);
    expect(tasks[1][0].date).toBe('2026-04-12');
  });

  it('prefers localized planting plan culture names', () => {
    const cultures: Culture[] = [
      { id: 5, name: 'Karotte', cultivation_types: ['direct_sowing'], growth_duration_days: 60 },
    ];
    const plans: PlantingPlan[] = [
      {
        id: 99,
        culture: 5,
        culture_name: 'Karotte',
        culture_display_name: 'Carrot',
        bed: 100,
        planting_date: '2026-04-12',
        cultivation_type: 'direct_sowing',
      },
    ];

    const tasks = deriveLocationTasks({
      locations,
      fields,
      beds,
      plantingPlans: plans,
      cultures,
      today: new Date('2026-04-01'),
    });

    expect(tasks[1][0].cultureName).toBe('Carrot');
    expect(tasks[1][1].cultureName).toBe('Carrot');
  });

  it('skips duplicates and tasks with missing relation data', () => {
    const cultures: Culture[] = [{ id: 6, name: 'Salat', cultivation_types: ['direct_sowing'] }];
    const plans: PlantingPlan[] = [
      { id: 1, culture: 6, bed: 100, planting_date: '2026-05-03', cultivation_type: 'direct_sowing' },
      { id: 1, culture: 6, bed: 100, planting_date: '2026-05-03', cultivation_type: 'direct_sowing' },
      { id: 2, culture: 6, bed: 9999, planting_date: '2026-05-03', cultivation_type: 'direct_sowing' },
    ];

    const tasks = deriveLocationTasks({
      locations,
      fields,
      beds,
      plantingPlans: plans,
      cultures,
      today: new Date('2026-04-01'),
    });

    expect(tasks[1]).toHaveLength(1);
  });
});
