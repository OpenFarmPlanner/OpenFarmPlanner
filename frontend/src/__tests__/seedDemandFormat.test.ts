import { describe, expect, it } from 'vitest';
import type { SeedDemand } from '../api/types';
import {
  formatPackageSelection,
  formatRequiredSeedAmount,
  formatSeedAmount,
  formatUnit,
} from '../pages/seedDemandFormat';

const t = (key: string): string => {
  const labels: Record<string, string> = {
    'seedDemand.unitSeeds': 'Korn',
    'seedDemand.unitGrams': 'g',
  };
  return labels[key] ?? key;
};

describe('formatUnit', () => {
  it('maps unit codes to localized labels', () => {
    expect(formatUnit('seeds', t)).toBe('Korn');
    expect(formatUnit('g', t)).toBe('g');
  });
});

describe('formatSeedAmount', () => {
  it('formats numbers with the German locale', () => {
    expect(formatSeedAmount(1234.5)).toBe('1.234,5');
  });
});

describe('formatRequiredSeedAmount', () => {
  it('always renders two fraction digits', () => {
    expect(formatRequiredSeedAmount(12)).toBe('12,00');
  });
});

describe('formatPackageSelection', () => {
  it('joins the selected packages and appends counts above one', () => {
    const row = {
      package_suggestion: {
        selection: [
          { size_value: 50, size_unit: 'g', count: 1 },
          { size_value: 1000, size_unit: 'seeds', count: 3 },
        ],
      },
    } as unknown as SeedDemand;

    expect(formatPackageSelection(row, t)).toBe('50 g + 1.000 Korn × 3');
  });

  it('returns an empty string when there is no selection', () => {
    expect(formatPackageSelection({} as SeedDemand, t)).toBe('');
  });
});
