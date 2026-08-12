import { useState, useEffect, useMemo } from 'react';
import {
  cultureAPI,
  locationAPI,
  fieldAPI,
  bedAPI,
  type Culture,
  type Bed,
} from '../api/api';
import type { Field, Location, CultivationType } from '../api/types';
import {
  getAllowedCultivationTypesForCulture,
} from './plantingPlansUtils';
import {
  toNumericValue,
  formatAreaM2,
  buildAreaColumnHeaderLabel,
  buildBedDisplayLabel,
  AREA_LABEL_SEPARATOR,
} from './plantingPlansUtils';
import { resolveLocaleFromLanguage } from '../utils/numberLocalization';
import { collectHierarchyAvailability } from '../components/planting-plans/areaHierarchySelection';
import type { SearchableSelectOption } from '../components/data-grid';
import { useTranslation } from '../i18n';
import { formatCultureDisplayName } from '../cultures/cultureDisplay';

export interface CultivationTypeSelectOption {
  value: CultivationType;
  label: string;
}

// Stable identities so consumers' memos do not see new arrays on every
// render while no project is selected.
const EMPTY_CULTURES: Culture[] = [];
const EMPTY_LOCATIONS: Location[] = [];
const EMPTY_FIELDS: Field[] = [];
const EMPTY_BEDS: Bed[] = [];

const CULTIVATION_TYPE_OPTIONS = [
  { value: 'direct_sowing', labelKey: 'plantingPlans:cultivationTypes.directSowing' },
  { value: 'pre_cultivation', labelKey: 'plantingPlans:cultivationTypes.preCultivation' },
] as const;

const CULTURE_COLUMN_MAX_WIDTH = 280;
const BED_COLUMN_MAX_WIDTH = 220;
const DATE_COLUMN_WIDTH = 142;

const estimateColumnWidth = (values: string[], min: number, max: number): number => {
  const longest = values.reduce((length, value) => Math.max(length, value.length), 0);
  const estimated = longest * 8 + 52;
  return Math.max(min, Math.min(max, estimated));
};

export function usePlantingPlanHierarchy(shouldShowProjectRequiredState: boolean) {
  const { t } = useTranslation(['plantingPlans', 'common']);
  const { i18n } = useTranslation();
  const numberLocale = resolveLocaleFromLanguage(i18n.language);

  const [loadedCultures, setCultures] = useState<Culture[]>([]);
  const [loadedLocations, setLocations] = useState<Location[]>([]);
  const [loadedFields, setFields] = useState<Field[]>([]);
  const [loadedBeds, setBeds] = useState<Bed[]>([]);
  const [isFetching, setIsHierarchyLoading] = useState(true);

  // Without a project nothing is fetched, so the hook reports an empty,
  // settled result. Derived during render rather than pushed into state from
  // the effect below, which is what react-hooks/set-state-in-effect flags.
  const cultures = shouldShowProjectRequiredState ? EMPTY_CULTURES : loadedCultures;
  const locations = shouldShowProjectRequiredState ? EMPTY_LOCATIONS : loadedLocations;
  const fields = shouldShowProjectRequiredState ? EMPTY_FIELDS : loadedFields;
  const beds = shouldShowProjectRequiredState ? EMPTY_BEDS : loadedBeds;
  const isHierarchyLoading = shouldShowProjectRequiredState ? false : isFetching;

  useEffect(() => {
    if (shouldShowProjectRequiredState) {
      return;
    }
    const fetchData = async (): Promise<void> => {
      setIsHierarchyLoading(true);
      try {
        const [culturesResponse, locationsResponse, fieldsResponse, bedsResponse] = await Promise.all([
          cultureAPI.listAll(),
          locationAPI.listAll(),
          fieldAPI.listAll(),
          bedAPI.listAll(),
        ]);
        setCultures(culturesResponse.results);
        setLocations(locationsResponse.results);
        setFields(fieldsResponse.results);
        setBeds(
          bedsResponse.results.map((bed) => ({
            ...bed,
            area_sqm: toNumericValue(bed.area_sqm) ?? undefined,
          })),
        );
      } catch (err) {
        console.error('Error fetching hierarchy data:', err);
      } finally {
        setIsHierarchyLoading(false);
      }
    };
    fetchData();
  }, [shouldShowProjectRequiredState]);

  const cultureOptions: SearchableSelectOption[] = useMemo(
    () =>
      cultures
        .filter((c) => c.id !== undefined)
        .map((c) => ({
          value: c.id!,
          label: formatCultureDisplayName(c),
        })),
    [cultures],
  );

  const locationById = useMemo(
    () => new Map(locations.filter((l) => l.id !== undefined).map((l) => [l.id!, l])),
    [locations],
  );

  const fieldById = useMemo(
    () => new Map(fields.filter((f) => f.id !== undefined).map((f) => [f.id!, f])),
    [fields],
  );

  const bedById = useMemo(
    () => new Map(beds.filter((b) => b.id !== undefined).map((b) => [b.id!, b])),
    [beds],
  );

  const hierarchyAvailability = useMemo(
    () => collectHierarchyAvailability(fields, beds),
    [fields, beds],
  );

  const bedOptions: SearchableSelectOption[] = useMemo(() => {
    const locationIdsWithBeds = new Set<number>();
    beds.forEach((bed) => {
      const field = fieldById.get(bed.field);
      if (field) locationIdsWithBeds.add(field.location);
    });
    const includeLocation = locationIdsWithBeds.size > 1;

    return beds
      .filter((b) => b.id !== undefined)
      .filter((bed) => hierarchyAvailability.fieldIdsWithBeds.has(bed.field))
      .map((b) => {
        const field = fieldById.get(b.field);
        const locationName = field ? locationById.get(field.location)?.name : null;
        const normalizedAreaSqm = toNumericValue(b.area_sqm);
        return {
          value: b.id!,
          label: buildBedDisplayLabel(
            locationName,
            b.field_name ?? field?.name,
            b.name,
            normalizedAreaSqm,
            includeLocation,
            numberLocale,
          ),
        };
      });
  }, [beds, fieldById, hierarchyAvailability.fieldIdsWithBeds, locationById, numberLocale]);

  const bedLabelById = useMemo(
    () => new Map(bedOptions.map((option) => [option.value as number, option.label])),
    [bedOptions],
  );

  const cultivationTypeOptions: CultivationTypeSelectOption[] = useMemo(
    () => CULTIVATION_TYPE_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) })),
    [t],
  );

  const cultivationTypeOptionsByCultureId = useMemo(() => {
    const optionsByCultureId = new Map<number, CultivationTypeSelectOption[]>();
    cultures.forEach((culture) => {
      if (culture.id === undefined) return;
      const allowedTypes = getAllowedCultivationTypesForCulture(culture);
      optionsByCultureId.set(
        culture.id,
        cultivationTypeOptions.filter((option) => allowedTypes.includes(option.value as CultivationType)),
      );
    });
    return optionsByCultureId;
  }, [cultivationTypeOptions, cultures]);

  const hasMultipleLocationsWithBeds = useMemo(() => {
    const fieldByIdLocal = new Map(
      fields.filter((item) => item.id !== undefined).map((item) => [item.id as number, item]),
    );
    const locationIdsWithBeds = new Set<number>();
    beds.forEach((bed) => {
      const field = fieldByIdLocal.get(bed.field);
      if (field) locationIdsWithBeds.add(field.location);
    });
    return locationIdsWithBeds.size > 1;
  }, [beds, fields]);

  const fieldBedColumnLabel = useMemo(
    () => t('plantingPlans:columns.fieldBed', { separator: AREA_LABEL_SEPARATOR }),
    [t],
  );

  const areaColumnLabel = useMemo(
    () =>
      buildAreaColumnHeaderLabel(
        hasMultipleLocationsWithBeds,
        t('plantingPlans:columns.location'),
        t('plantingPlans:columns.field'),
        t('plantingPlans:columns.bed'),
      ),
    [hasMultipleLocationsWithBeds, t],
  );

  const getCultivationTypeOptionsForRow = useMemo(
    () =>
      (row: { culture: number | null }): CultivationTypeSelectOption[] =>
        typeof row.culture === 'number'
          ? cultivationTypeOptionsByCultureId.get(row.culture) ?? cultivationTypeOptions
          : cultivationTypeOptions,
    [cultivationTypeOptions, cultivationTypeOptionsByCultureId],
  );

  const dynamicWidths = useMemo(() => {
    const cultureWidth = estimateColumnWidth(
      [t('plantingPlans:columns.culture'), ...cultureOptions.map((option) => option.label)],
      170,
      CULTURE_COLUMN_MAX_WIDTH,
    );
    const hierarchyColumnValues = [
      t('plantingPlans:columns.bed'),
      ...Array.from(new Set(bedOptions.map((option) => option.label))),
    ];
    const bedWidth = estimateColumnWidth(
      hierarchyColumnValues,
      hasMultipleLocationsWithBeds ? 210 : 160,
      hasMultipleLocationsWithBeds ? 380 : BED_COLUMN_MAX_WIDTH,
    );
    return {
      culture: cultureWidth,
      bed: bedWidth,
      cultivationType: estimateColumnWidth(
        [t('plantingPlans:columns.cultivationType'), ...cultivationTypeOptions.map((option) => option.label)],
        110,
        150,
      ),
      plantingDate: DATE_COLUMN_WIDTH,
      harvestDate: DATE_COLUMN_WIDTH,
      harvestEndDate: DATE_COLUMN_WIDTH,
      area: estimateColumnWidth(
        [
          t('plantingPlans:columns.areaM2'),
          ...beds
            .filter((bed) => typeof bed.area_sqm === 'number')
            .map((bed) => formatAreaM2(bed.area_sqm as number, numberLocale)),
        ],
        95,
        120,
      ),
      plants: estimateColumnWidth([t('plantingPlans:columns.plantsCount'), '≈ 9999'], 96, 122),
      notes: 220,
    };
  }, [bedOptions, beds, cultivationTypeOptions, cultureOptions, hasMultipleLocationsWithBeds, numberLocale, t]);

  return {
    cultures,
    locations,
    fields,
    beds,
    isHierarchyLoading,
    numberLocale,
    cultureOptions,
    locationById,
    fieldById,
    bedById,
    hierarchyAvailability,
    bedOptions,
    bedLabelById,
    cultivationTypeOptions,
    cultivationTypeOptionsByCultureId,
    hasMultipleLocationsWithBeds,
    fieldBedColumnLabel,
    areaColumnLabel,
    getCultivationTypeOptionsForRow,
    dynamicWidths,
  };
}
