import type { Culture } from '../api/api';
import type {
  CultivationType,
  CultureSupplierData,
  CultureSupplierDataInput,
} from '../api/types';
import { isEmptySupplierDataRow } from '../cultures/supplierDataRows';
import { buildSeedRateByCultivation } from '../cultures/seedRatePayload';
import {
  normalizeCultivationType,
  normalizeHarvestMethod,
  normalizeNutrientDemand,
  normalizeSeedingRequirementType,
  normalizeSeedRateUnit,
} from '../cultures/enumNormalization';

export type CultureSavePayload = Culture & {
  supplier_id: number | null;
  supplier_name?: string;
  supplier?: undefined;
};

const SPECIES_INVARIANT_GENERAL_FIELDS: readonly (keyof Culture)[] = [
  'crop_family',
  'nutrient_demand',
  'rotation_break_years',
];

const ORGANIZATIONAL_GENERAL_FIELDS: readonly (keyof Culture)[] = [
  'display_color',
  'notes',
  'cultivation_type',
  'cultivation_types',
];

type FirstVarietyGeneralCultureDraft = Pick<Culture, 'name'> & Partial<Culture>;

export function buildGeneralCultureDraftForFirstVariety(
  culture: Culture,
): FirstVarietyGeneralCultureDraft {
  const draft: FirstVarietyGeneralCultureDraft = {
    name: culture.name,
    variety: '',
    crop_species: culture.crop_species,
    source_public_culture: culture.source_public_culture,
    source_public_version: culture.source_public_version,
    origin_type: culture.origin_type,
  };
  const fieldsToCopy = [
    ...ORGANIZATIONAL_GENERAL_FIELDS,
    ...SPECIES_INVARIANT_GENERAL_FIELDS,
  ];

  fieldsToCopy.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(culture, field)) {
      (draft as Record<keyof Culture, Culture[keyof Culture]>)[field] = culture[field];
    }
  });

  return draft;
}

const mapSupplierDataRowToInput = (row: CultureSupplierData): CultureSupplierDataInput => ({
  id: row.id,
  supplier_id: row.supplier_id ?? row.supplier?.id ?? null,
  supplier_name_input: row.supplier_name_input,
  supplier_name: row.supplier_name ?? row.supplier?.name,
  supplier_product_name: row.supplier_product_name,
  supplier_product_url: row.supplier_product_url,
  packaging_sizes: row.packaging_sizes ?? [],
  germination_rate: row.germination_rate ?? null,
  price: row.price ?? null,
  notes: row.notes ?? '',
  source_url: row.source_url ?? '',
});

const isSeedRateCultivationType = (value: unknown): value is CultivationType => (
  value === 'pre_cultivation' || value === 'direct_sowing'
);

export function buildCultureSavePayload(culture: Culture): CultureSavePayload {
  const supplierPayloadRows: CultureSupplierDataInput[] = [];
  if (Array.isArray(culture.supplier_data) && culture.supplier_data.length > 0) {
    supplierPayloadRows.push(
      ...culture.supplier_data
        .filter((row) => !isEmptySupplierDataRow(row))
        .map(mapSupplierDataRowToInput),
    );
  } else if (culture.supplier) {
    supplierPayloadRows.push({
      supplier_id: culture.supplier.id ?? null,
      supplier_name_input: culture.supplier.id ? undefined : culture.supplier.name,
      supplier_name: culture.supplier.name,
      supplier_product_url: culture.supplier_product_url ?? '',
      packaging_sizes: [],
    });
  }

  const cultivationTypes: CultivationType[] = (culture.cultivation_types && culture.cultivation_types.length > 0)
    ? culture.cultivation_types.filter(isSeedRateCultivationType)
    : (culture.cultivation_type
      ? [normalizeCultivationType(culture.cultivation_type)].filter(isSeedRateCultivationType)
      : ['pre_cultivation']);
  const seedRateUnit = normalizeSeedRateUnit(culture.seed_rate_unit) ?? null;
  const seedRateDirectUnit = normalizeSeedRateUnit(culture.seed_rate_direct_unit) ?? null;
  const seedRatePreCultivationUnit = normalizeSeedRateUnit(culture.seed_rate_pre_cultivation_unit) ?? null;
  const seedRateFallbackFields = buildSeedRateByCultivation(
    culture,
    cultivationTypes,
    seedRateUnit,
    seedRateDirectUnit,
    seedRatePreCultivationUnit,
  );

  const payload: CultureSavePayload = {
    ...culture,
    seed_packages: undefined,
    seed_rate_unit: seedRateFallbackFields.seed_rate_unit,
    seed_rate_direct_unit: seedRateDirectUnit,
    seed_rate_pre_cultivation_unit: seedRatePreCultivationUnit,
    harvest_method: normalizeHarvestMethod(culture.harvest_method),
    nutrient_demand: normalizeNutrientDemand(culture.nutrient_demand),
    cultivation_type: normalizeCultivationType(culture.cultivation_type),
    cultivation_types: cultivationTypes,
    seed_rate_value: seedRateFallbackFields.seed_rate_value,
    seed_rate_by_cultivation: seedRateFallbackFields.seed_rate_by_cultivation,
    seeding_requirement_type: normalizeSeedingRequirementType(culture.seeding_requirement_type),
    supplier_id: culture.supplier?.id || null,
    supplier_name: culture.supplier && !culture.supplier.id ? culture.supplier.name : undefined,
    supplier_data_input: supplierPayloadRows,
    supplier: undefined,
  };

  delete (payload as unknown as Record<string, unknown>).distance_within_row_m;
  delete (payload as unknown as Record<string, unknown>).row_spacing_m;
  delete (payload as unknown as Record<string, unknown>).sowing_depth_m;

  // Read-only inheritance data: the backend resolves these per response and
  // ignores them on write, so sending them back is pure payload noise.
  delete (payload as unknown as Record<string, unknown>).general_culture;
  delete (payload as unknown as Record<string, unknown>).inherited_fields;
  delete (payload as unknown as Record<string, unknown>).effective_values;

  return payload;
}
