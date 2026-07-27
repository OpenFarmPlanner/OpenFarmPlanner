import { describe, expect, it } from 'vitest';
import type { SeedDemand } from '../api/types';
import {
  getPackageBlockerTooltip,
  getPackageCellState,
  getRequiredAmountDiagnostic,
  hasPackageCellTooltip,
  type SeedDemandTranslator,
} from '../pages/seedDemandDiagnostics';

const translations: Record<string, string> = {
  'seedDemand.requiredAmountUnavailable': 'Nicht berechenbar ({{reason}})',
  'seedDemand.requiredAmountUnavailableTooltip': 'Fehlende Angabe: {{reason}}.',
  'seedDemand.requiredAmountUnavailableMultipleTooltip': 'Fehlende Angaben: {{reasons}}.',
  'seedDemand.calculationBlockers.missingSeedRate': 'Aussaatmenge fehlt',
  'seedDemand.calculationBlockers.missingArea': 'Beetfläche fehlt',
  'seedDemand.calculationBlockers.missingPlantQuantity': 'Pflanzenanzahl fehlt',
  'seedDemand.calculationBlockers.missingRowSpacing': 'Reihenabstand fehlt',
  'seedDemand.calculationBlockers.missingTkg': 'TKG fehlt',
  'seedDemand.calculationBlockers.missingData': 'notwendige Angaben fehlen',
  'seedDemand.packageBlockers.requiredAmountUnavailable': 'Kein Packungsvorschlag. {{details}}',
  'seedDemand.packageBlockers.unitConversionUnavailable': 'Einheiten nicht umrechenbar.',
  'seedDemand.packageBlockers.noMatchingPackageSizes': 'Keine passende Packungsgröße.',
  'seedDemand.noSupplierConfiguredTooltip': 'Keine Lieferantendaten.',
  'seedDemand.supplierNotSelectedTooltip': 'Kein Lieferant ausgewählt.',
  'seedDemand.noPackagesAvailableTooltip': 'Keine Packungsgrößen hinterlegt.',
};

const t: SeedDemandTranslator = (key, options = {}) => Object.entries(options).reduce(
  (text, [name, value]) => text.replace(`{{${name}}}`, String(value)),
  translations[key] ?? key,
);

const row = (overrides: Partial<SeedDemand>): SeedDemand => ({
  culture_id: 1,
  culture_name: 'Test',
  total_grams: null,
  required_amount_value: null,
  required_amount_unit: 'g',
  warning: null,
  ...overrides,
});

describe('seed demand diagnostics', () => {
  it.each([
    ['missing_seed_rate', 'Nicht berechenbar (Aussaatmenge fehlt)'],
    ['missing_area', 'Nicht berechenbar (Beetfläche fehlt)'],
    ['missing_plant_quantity', 'Nicht berechenbar (Pflanzenanzahl fehlt)'],
    ['missing_row_spacing', 'Nicht berechenbar (Reihenabstand fehlt)'],
    ['missing_tkg', 'Nicht berechenbar (TKG fehlt)'],
  ])('renders the visible blocker for %s', (blocker, expected) => {
    expect(getRequiredAmountDiagnostic(row({ calculation_blockers: [blocker] }), t)?.displayText)
      .toBe(expected);
  });

  it('uses stable precedence and lists every missing input in the tooltip', () => {
    const diagnostic = getRequiredAmountDiagnostic(row({
      calculation_blockers: ['missing_row_spacing', 'missing_area'],
    }), t);

    expect(diagnostic?.displayText).toBe('Nicht berechenbar (Beetfläche fehlt)');
    expect(diagnostic?.tooltipText).toBe('Fehlende Angaben: Beetfläche fehlt, Reihenabstand fehlt.');
  });

  it.each([
    ['required_amount_unavailable', 'Kein Packungsvorschlag. Fehlende Angabe: Beetfläche fehlt.'],
    ['supplier_data_missing', 'Keine Lieferantendaten.'],
    ['supplier_not_selected', 'Kein Lieferant ausgewählt.'],
    ['package_sizes_missing', 'Keine Packungsgrößen hinterlegt.'],
    ['unit_conversion_unavailable', 'Einheiten nicht umrechenbar.'],
    ['no_matching_package_sizes', 'Keine passende Packungsgröße.'],
  ])('uses the matching package tooltip for %s', (packageBlocker, expected) => {
    expect(getPackageBlockerTooltip(row({
      calculation_blockers: packageBlocker === 'required_amount_unavailable' ? ['missing_area'] : [],
      package_blocker: packageBlocker,
    }), t)).toBe(expected);
  });

  it('leaves normal calculated values without a required-amount diagnostic', () => {
    expect(getRequiredAmountDiagnostic(row({
      required_amount_value: 12.5,
      required_amount_unit: 'g',
    }), t)).toBeNull();
  });
});

describe('getPackageCellState', () => {
  it('returns "computed" when a package selection exists', () => {
    expect(getPackageCellState(row({
      required_amount_value: 10,
      package_suggestion: { selection: [{ size_value: 5, size_unit: 'g', count: 2 }] },
    } as Partial<SeedDemand>))).toBe('computed');
  });

  it('returns "unavailableRequirement" when the required amount is missing', () => {
    expect(getPackageCellState(row({ required_amount_value: null }))).toBe('unavailableRequirement');
  });

  it('returns "chooseSupplier" when no supplier data is available', () => {
    expect(getPackageCellState(row({
      required_amount_value: 10,
      supplier_options: [],
    } as Partial<SeedDemand>))).toBe('chooseSupplier');
  });

  it('returns "calculationError" for a non-actionable blocker', () => {
    expect(getPackageCellState(row({ package_blocker: 'unit_conversion_unavailable' }))).toBe('calculationError');
  });
});

describe('hasPackageCellTooltip', () => {
  it('is false when a package selection exists', () => {
    expect(hasPackageCellTooltip(row({
      required_amount_value: 10,
      package_suggestion: { selection: [{ size_value: 5, size_unit: 'g', count: 1 }] },
    } as Partial<SeedDemand>))).toBe(false);
  });

  it('is true when a blocker prevents a package suggestion', () => {
    expect(hasPackageCellTooltip(row({ required_amount_value: null }))).toBe(true);
  });
});
