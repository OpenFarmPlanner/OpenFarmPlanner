import type { SeedDemand } from '../api/types';

export type SeedDemandTranslator = (key: string, options?: Record<string, unknown>) => string;

const CALCULATION_BLOCKER_PRIORITY = [
  'missing_seed_rate',
  'missing_area',
  'missing_plant_quantity',
  'missing_row_spacing',
  'missing_tkg',
  'unsupported_seed_rate_unit',
] as const;

const LEGACY_WARNING_BLOCKERS: Record<string, string> = {
  'Missing seed rate value or unit.': 'missing_seed_rate',
  'Missing area usage for m²-based seed requirement.': 'missing_area',
  'Missing area usage for lfm-based seed requirement.': 'missing_area',
  'Missing plant quantity for seeds-per-plant requirement.': 'missing_plant_quantity',
  'Missing row spacing for lfm-based seed requirement.': 'missing_row_spacing',
  'Unsupported seed rate unit.': 'unsupported_seed_rate_unit',
};

const BLOCKER_LABEL_KEYS: Record<string, string> = {
  missing_seed_rate: 'seedDemand.calculationBlockers.missingSeedRate',
  missing_area: 'seedDemand.calculationBlockers.missingArea',
  missing_plant_quantity: 'seedDemand.calculationBlockers.missingPlantQuantity',
  missing_row_spacing: 'seedDemand.calculationBlockers.missingRowSpacing',
  missing_tkg: 'seedDemand.calculationBlockers.missingTkg',
  unsupported_seed_rate_unit: 'seedDemand.calculationBlockers.unsupportedSeedRateUnit',
};

export const getSeedDemandCalculationBlockers = (row: SeedDemand): string[] => {
  const blockers = [...(row.calculation_blockers ?? [])];
  if (row.required_amount_warning === 'missing_tkg') {
    blockers.push('missing_tkg');
  }
  if (row.warning && LEGACY_WARNING_BLOCKERS[row.warning]) {
    blockers.push(LEGACY_WARNING_BLOCKERS[row.warning]);
  }

  const unique = [...new Set(blockers)];
  return unique.sort((left, right) => {
    const leftIndex = CALCULATION_BLOCKER_PRIORITY.indexOf(left as (typeof CALCULATION_BLOCKER_PRIORITY)[number]);
    const rightIndex = CALCULATION_BLOCKER_PRIORITY.indexOf(right as (typeof CALCULATION_BLOCKER_PRIORITY)[number]);
    return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex)
      - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
  });
};

const getBlockerLabel = (blocker: string, t: SeedDemandTranslator): string => (
  t(BLOCKER_LABEL_KEYS[blocker] ?? 'seedDemand.calculationBlockers.missingData')
);

export interface RequiredAmountDiagnostic {
  displayText: string;
  tooltipText: string;
}

export const getRequiredAmountDiagnostic = (
  row: SeedDemand,
  t: SeedDemandTranslator,
): RequiredAmountDiagnostic | null => {
  if (row.required_amount_value !== null && row.required_amount_unit !== null) {
    return null;
  }

  const blockers = getSeedDemandCalculationBlockers(row);
  const labels = blockers.length > 0
    ? blockers.map((blocker) => getBlockerLabel(blocker, t))
    : [t('seedDemand.calculationBlockers.missingData')];

  return {
    displayText: t('seedDemand.requiredAmountUnavailable', { reason: labels[0] }),
    tooltipText: labels.length === 1
      ? t('seedDemand.requiredAmountUnavailableTooltip', { reason: labels[0] })
      : t('seedDemand.requiredAmountUnavailableMultipleTooltip', { reasons: labels.join(', ') }),
  };
};

export const getEffectivePackageBlocker = (row: SeedDemand): string | null => {
  if ((row.package_suggestion?.selection ?? []).length > 0) {
    return null;
  }
  if (row.package_blocker) {
    return row.package_blocker;
  }
  if (row.required_amount_value === null || row.required_amount_unit === null) {
    return 'required_amount_unavailable';
  }
  const supplierOptions = row.supplier_options ?? [];
  if (supplierOptions.length === 0) {
    return 'supplier_data_missing';
  }
  if (supplierOptions.length > 1 && row.selected_supplier_id == null) {
    return 'supplier_not_selected';
  }
  if ((row.seed_packages ?? []).length === 0) {
    return 'package_sizes_missing';
  }
  return 'no_matching_package_sizes';
};

export const getPackageBlockerTooltip = (row: SeedDemand, t: SeedDemandTranslator): string => {
  const blocker = getEffectivePackageBlocker(row);
  if (blocker === 'required_amount_unavailable') {
    const requiredAmountDiagnostic = getRequiredAmountDiagnostic(row, t);
    return t('seedDemand.packageBlockers.requiredAmountUnavailable', {
      details: requiredAmountDiagnostic?.tooltipText ?? '',
    });
  }

  const keyByBlocker: Record<string, string> = {
    supplier_data_missing: 'seedDemand.noSupplierConfiguredTooltip',
    supplier_not_selected: 'seedDemand.supplierNotSelectedTooltip',
    package_sizes_missing: 'seedDemand.noPackagesAvailableTooltip',
    unit_conversion_unavailable: 'seedDemand.packageBlockers.unitConversionUnavailable',
    no_matching_package_sizes: 'seedDemand.packageBlockers.noMatchingPackageSizes',
  };
  return t(keyByBlocker[blocker ?? ''] ?? 'seedDemand.noPackageCalculationPossibleTooltip');
};

export type PackageCellState =
  | 'computed'
  | 'chooseSupplier'
  | 'notConfigured'
  | 'unavailableRequirement'
  | 'calculationError';

export const getPackageCellState = (row: SeedDemand): PackageCellState => {
  const blocker = getEffectivePackageBlocker(row);
  if (!blocker) {
    return 'computed';
  }
  switch (blocker) {
    case 'supplier_data_missing':
    case 'supplier_not_selected':
      return 'chooseSupplier';
    case 'package_sizes_missing':
      return 'notConfigured';
    case 'required_amount_unavailable':
      return 'unavailableRequirement';
    default:
      return 'calculationError';
  }
};

export const hasPackageCellTooltip = (row: SeedDemand): boolean =>
  getEffectivePackageBlocker(row) !== null;
