import type {
  Culture,
  CultureSupplierData,
  CultureSupplierDataInput,
  SeedPackage,
  SeedRateByCultivation,
} from '../api/types';
import { isEmptySupplierDataRow } from './supplierDataRows';

type SupplierDataDraft = CultureSupplierData | CultureSupplierDataInput;

const textFields = [
  'name',
  'variety',
  'crop_family',
  'notes',
] as const satisfies readonly (keyof Culture)[];

const enumFields = [
  'nutrient_demand',
  'harvest_method',
  'seeding_requirement_type',
  'seed_rate_unit',
  'seed_rate_direct_unit',
  'seed_rate_pre_cultivation_unit',
] as const satisfies readonly (keyof Culture)[];

const numberFields = [
  'growth_duration_days',
  'harvest_duration_days',
  'propagation_duration_days',
  'expected_yield',
  'distance_within_row_cm',
  'row_spacing_cm',
  'sowing_depth_cm',
  'sowing_calculation_safety_percent',
  'sowing_calculation_safety_percent_direct',
  'sowing_calculation_safety_percent_pre_cultivation',
  'thousand_kernel_weight_g',
  'seeding_requirement',
  'seed_rate_value',
  'seed_rate_direct_value',
  'seed_rate_pre_cultivation_value',
] as const satisfies readonly (keyof Culture)[];

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const normalizeEnum = (value: unknown): string | null => normalizeText(value);

const normalizeColor = (value: unknown): string | null => normalizeText(value)?.toLowerCase() ?? null;

const normalizeNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value.trim().replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizeCultivationTypes = (culture: Partial<Culture>): string[] => {
  const values = culture.cultivation_types?.length
    ? culture.cultivation_types
    : culture.cultivation_type
      ? [culture.cultivation_type]
      : [];

  return Array.from(
    new Set(values.map((value) => normalizeEnum(value)).filter((value): value is string => value !== null)),
  ).sort();
};

const normalizeSeedRateByCultivation = (value: SeedRateByCultivation | null | undefined): Record<string, { value: number | null; unit: string | null }> | null => {
  if (!value) {
    return null;
  }

  const entries: Array<[string, { value: number | null; unit: string | null }]> = Object.entries(value)
    .map(([key, entry]) => [
      key,
      {
        value: normalizeNumber(entry?.value),
        unit: normalizeEnum(entry?.unit),
      },
    ]);
  const normalized = Object.fromEntries(
    entries
      .filter(([, entry]) => entry.value !== null || entry.unit !== null)
      .sort(([left], [right]) => left.localeCompare(right)),
  );

  return Object.keys(normalized).length > 0 ? normalized : null;
};

const normalizePackage = (seedPackage: SeedPackage): { size_value: number | null; size_unit: string | null } => ({
  size_value: normalizeNumber(seedPackage.size_value),
  size_unit: normalizeEnum(seedPackage.size_unit),
});

const normalizeSupplierRow = (row: SupplierDataDraft): Record<string, unknown> => {
  const supplierId = normalizeNumber(row.supplier_id ?? (row as CultureSupplierData).supplier?.id);
  const supplierNameInput = normalizeText(row.supplier_name_input);
  const supplierName = normalizeText(row.supplier_name ?? (row as CultureSupplierData).supplier?.name);
  const packagingSizes = (row.packaging_sizes ?? [])
    .map(normalizePackage)
    .filter((seedPackage) => seedPackage.size_value !== null || seedPackage.size_unit !== null)
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));

  return {
    supplier_id: supplierId,
    supplier_name_input: supplierNameInput,
    supplier_name: supplierId === null ? supplierName : null,
    supplier_url: normalizeText(row.supplier_url),
    supplier_product_name: normalizeText(row.supplier_product_name),
    supplier_product_url: normalizeText(row.supplier_product_url),
    packaging_sizes: packagingSizes,
    germination_rate: normalizeNumber(row.germination_rate),
    price: normalizeNumber(row.price),
    notes: normalizeText(row.notes),
    source_url: normalizeText(row.source_url),
  };
};

const normalizeSupplierRows = (rows: SupplierDataDraft[] | undefined): Record<string, unknown>[] => (
  (rows ?? [])
    .filter((row) => !isEmptySupplierDataRow(row))
    .map(normalizeSupplierRow)
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
);

export function normalizeCultureFormData(culture: Partial<Culture>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  textFields.forEach((field) => {
    normalized[field] = normalizeText(culture[field]);
  });
  enumFields.forEach((field) => {
    normalized[field] = normalizeEnum(culture[field]);
  });
  numberFields.forEach((field) => {
    normalized[field] = normalizeNumber(culture[field]);
  });

  normalized.cultivation_types = normalizeCultivationTypes(culture);
  normalized.display_color = normalizeColor(culture.display_color);
  normalized.seed_rate_by_cultivation = normalizeSeedRateByCultivation(culture.seed_rate_by_cultivation);
  normalized.supplier_data = normalizeSupplierRows(culture.supplier_data);

  return normalized;
}

export function hasEffectiveCultureFormChanges(
  initialData: Partial<Culture>,
  currentData: Partial<Culture>,
): boolean {
  return JSON.stringify(normalizeCultureFormData(initialData)) !== JSON.stringify(normalizeCultureFormData(currentData));
}
