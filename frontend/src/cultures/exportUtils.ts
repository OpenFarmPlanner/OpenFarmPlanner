import type { Culture } from '../api/types';
import { formatIsoDate } from '../utils/isoDate';

interface ExportEnvelopeBase {
  schemaVersion: 1;
  exportedAt: string;
}

export interface PortableCulture {
  name: string;
  variety: string;
  supplierName: string;
  seed_supplier?: string;
  notes?: string;
  crop_family?: string;
  nutrient_demand?: Culture['nutrient_demand'];
  cultivation_type?: Culture['cultivation_type'];
  growth_duration_days?: number;
  harvest_duration_days?: number;
  propagation_duration_days?: number;
  harvest_method?: Culture['harvest_method'];
  expected_yield?: number;
  allow_deviation_delivery_weeks?: boolean;
  distance_within_row_cm?: number;
  row_spacing_cm?: number;
  sowing_depth_cm?: number;
  display_color?: string;
  seed_rate_value?: number | null;
  seed_rate_unit?: Culture['seed_rate_unit'];
  seed_rate_direct_value?: number | null;
  seed_rate_direct_unit?: Culture['seed_rate_direct_unit'];
  sowing_calculation_safety_percent_direct?: number | null;
  seed_rate_pre_cultivation_value?: number | null;
  seed_rate_pre_cultivation_unit?: Culture['seed_rate_pre_cultivation_unit'];
  sowing_calculation_safety_percent_pre_cultivation?: number | null;
  sowing_calculation_safety_percent?: number;
  thousand_kernel_weight_g?: number;
  package_size_g?: number;
  seeding_requirement?: number;
  seeding_requirement_type?: Culture['seeding_requirement_type'];
}

export interface SingleCultureExport extends ExportEnvelopeBase {
  type: 'culture';
  culture: PortableCulture;
}

export interface AllCulturesExport extends ExportEnvelopeBase {
  type: 'cultures';
  cultures: PortableCulture[];
}

export const slugifyFilenamePart = (value: string): string => {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || 'unbekannt';
};

export const toPortableCulture = (culture: Culture): PortableCulture => {
  const portableCulture: PortableCulture = {
    name: culture.name,
    variety: culture.variety ?? '',
    supplierName: culture.supplier?.name ?? culture.seed_supplier ?? '',
    seed_supplier: culture.seed_supplier,
    notes: culture.notes,
    crop_family: culture.crop_family,
    nutrient_demand: culture.nutrient_demand,
    cultivation_type: culture.cultivation_type,
    growth_duration_days: culture.growth_duration_days,
    harvest_duration_days: culture.harvest_duration_days,
    propagation_duration_days: culture.propagation_duration_days,
    harvest_method: culture.harvest_method,
    expected_yield: culture.expected_yield,
    allow_deviation_delivery_weeks: culture.allow_deviation_delivery_weeks,
    distance_within_row_cm: culture.distance_within_row_cm,
    row_spacing_cm: culture.row_spacing_cm,
    sowing_depth_cm: culture.sowing_depth_cm,
    display_color: culture.display_color,
    seed_rate_value: culture.seed_rate_value,
    seed_rate_unit: culture.seed_rate_unit,
    seed_rate_direct_value: culture.seed_rate_direct_value,
    seed_rate_direct_unit: culture.seed_rate_direct_unit,
    sowing_calculation_safety_percent_direct: culture.sowing_calculation_safety_percent_direct,
    seed_rate_pre_cultivation_value: culture.seed_rate_pre_cultivation_value,
    seed_rate_pre_cultivation_unit: culture.seed_rate_pre_cultivation_unit,
    sowing_calculation_safety_percent_pre_cultivation: culture.sowing_calculation_safety_percent_pre_cultivation,
    sowing_calculation_safety_percent: culture.sowing_calculation_safety_percent,
    thousand_kernel_weight_g: culture.thousand_kernel_weight_g,
    package_size_g: culture.package_size_g,
    seeding_requirement: culture.seeding_requirement,
    seeding_requirement_type: culture.seeding_requirement_type,
  };

  return Object.fromEntries(Object.entries(portableCulture).filter(([, value]) => value !== undefined)) as PortableCulture;
};

export const buildSingleCultureExport = (culture: Culture, date = new Date()): SingleCultureExport => ({
  schemaVersion: 1,
  exportedAt: formatIsoDate(date),
  type: 'culture',
  culture: toPortableCulture(culture),
});

export const buildAllCulturesExport = (cultures: Culture[], date = new Date()): AllCulturesExport => ({
  schemaVersion: 1,
  exportedAt: formatIsoDate(date),
  type: 'cultures',
  cultures: cultures.map(toPortableCulture),
});

export const downloadJsonFile = (data: object, filename: string): void => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
};

export const buildSingleCultureFilename = (culture: Culture, date = new Date()): string => {
  const name = slugifyFilenamePart(culture.name);
  const variety = slugifyFilenamePart(culture.variety ?? '');
  return `kultur_${name}_${variety}_${formatIsoDate(date)}.json`;
};

export const buildAllCulturesFilename = (date = new Date()): string => `kulturen_export_${formatIsoDate(date)}.json`;
