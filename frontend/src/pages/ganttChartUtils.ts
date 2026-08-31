import type { Bed, Culture, Field, Location, PlantingPlan } from '../api/types';
import { formatLocalizedNumber } from '../utils/numberLocalization';
import { addUtcDays, formatIsoDate, parseIsoDate } from '../utils/isoDate';
import { formatCultureDisplayName, getCultureDisplayName } from '../cultures/cultureDisplay';
import { getEffectiveCultureValue } from '../cultures/varietyValueSource';
import { getGanttPhaseColors } from '../utils/colorContrast';

export interface GanttTask {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  color?: string;
  percent?: number;
  dependencies?: string[];
  plantingPlanId?: number;
  cultureName?: string;
  cultureVariety?: string;
  areaUsage?: number;
  notes?: string;
  harvestStartDate?: Date;
  harvestEndDate?: Date;
  propagationStartDate?: Date;
  propagationDurationDays?: number;
  transplantDate?: Date;
  targetBedName?: string;
  targetFieldName?: string;
  targetLocationName?: string;
  targetAreaUsage?: number;
  plantsCount?: number | null;
  plantingPlanCount?: number;
  involvedLocationNames?: string[];
}

export interface GanttTaskGroup {
  id: string;
  name: string;
  description?: string;
  hierarchyPath?: string[];
  icon?: string;
  tasks: GanttTask[];
  locationId?: number;
  fieldId?: number;
  bedId?: number;
  area?: number;
  isGroup?: boolean;
  level?: number;
  /** Tree-row rendering hints, forwarded as-is to the Gantt library. */
  depth?: number;
  isExpandable?: boolean;
  isExpanded?: boolean;
  /** Structural summary rendered in the row's timeline area instead of bars. */
  emptyRowLabel?: string;
  rowHeightOverride?: number;
}

interface BuildTaskGroupsArgs {
  locations: Location[];
  fields: Field[];
  beds: Bed[];
  plantingPlans: PlantingPlan[];
  cultures: Culture[];
}

/** Inclusive start/end of the calendar's visible time axis. */
export interface CalendarDateRange {
  start: Date;
  end: Date;
}

type ScheduledPlantingPlan = PlantingPlan & {
  id: number;
  bed: number;
  planting_date: string;
  harvest_date: string;
};

function isScheduledPlantingPlan(plan: PlantingPlan): plan is ScheduledPlantingPlan {
  return (
    typeof plan.id === 'number'
    && typeof plan.bed === 'number'
    && Boolean(plan.planting_date)
    && Boolean(plan.harvest_date)
  );
}

interface OccupancyBedGroupCandidate {
  id: string;
  locationId: number;
  locationName: string;
  fieldId: number;
  fieldName: string;
  bedId: number;
  bedName: string;
  tasks: GanttTask[];
  area?: number;
}

interface SeedlingTooltipDetail {
  labelKey: 'propagationStart' | 'transplantDate' | 'propagationDuration' | 'totalPlantsCount' | 'plantingPlanCount' | 'involvedLocations';
  value: string;
}

export interface OccupancyTooltipDetail {
  labelKey: 'plantingDate' | 'harvestDate' | 'firstHarvest' | 'lastHarvest' | 'areaUsage' | 'notes';
  value: string;
}

export function parseDateString(dateStr: string): Date {
  return parseIsoDate(dateStr) ?? new Date(Number.NaN);
}

export function getDefaultCultureColor(cultureName: string): string {
  const colors = [
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#ec4899',
    '#14b8a6',
    '#f97316',
  ];

  let hash = 0;
  for (let i = 0; i < cultureName.length; i++) {
    hash = cultureName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getCultureColor(
  cultures: Culture[],
  cultureId: number | null | undefined,
  cultureName: string,
  fallbackColor?: string | null,
): string {
  const culture = typeof cultureId === 'number'
    ? cultures.find((entry) => entry.id === cultureId)
    : undefined;
  return culture?.display_color || fallbackColor || getDefaultCultureColor(cultureName);
}

/**
 * Pre-cultivation (Anzucht) window for a single plan: the propagation start
 * (planting date minus the effective propagation duration) and the transplant
 * date (the planting date itself). Returns null for direct sowings, plans
 * without a usable propagation duration, or plans that are not scheduled yet.
 */
function getPlanPreCultivationDates(
  plan: PlantingPlan,
  cultureById: Map<number, Culture>,
): { propagationStartDate: Date; transplantDate: Date; propagationDurationDays: number } | null {
  if (!plan.id || !plan.culture || !plan.planting_date) {
    return null;
  }

  const culture = cultureById.get(plan.culture);
  // Effective values throughout: a Sorte inherits any timing/cultivation field
  // it does not set from its general Kultur, and the plan row already carries
  // the same resolved values as a fallback.
  const propagationDurationDays = getEffectiveCultureValue(culture, 'propagation_duration_days')
    ?? plan.culture_propagation_duration_days
    ?? undefined;
  if (!propagationDurationDays || propagationDurationDays <= 0) {
    return null;
  }

  const cultureCultivationType = getEffectiveCultureValue(culture, 'cultivation_type')
    || plan.culture_cultivation_type || '';
  const cultureCultivationTypes = getEffectiveCultureValue(culture, 'cultivation_types')
    || plan.culture_cultivation_types || [];
  const isPreCultivation = plan.cultivation_type === 'pre_cultivation'
    || (!plan.cultivation_type && (
      cultureCultivationType === 'pre_cultivation'
      || cultureCultivationTypes.includes('pre_cultivation')
    ));
  if (!isPreCultivation) {
    return null;
  }

  const transplantDate = parseDateString(plan.planting_date);
  const propagationStartDate = addUtcDays(transplantDate, -propagationDurationDays);
  return { propagationStartDate, transplantDate, propagationDurationDays };
}

function buildCultureById(cultures: Culture[]): Map<number, Culture> {
  const cultureById = new Map<number, Culture>();
  cultures.forEach((culture) => {
    if (culture.id) {
      cultureById.set(culture.id, culture);
    }
  });
  return cultureById;
}

function extendRange(
  range: { start: Date; end: Date } | null,
  candidateStart: Date,
  candidateEnd: Date,
): { start: Date; end: Date } {
  if (!range) {
    return { start: candidateStart, end: candidateEnd };
  }
  return {
    start: candidateStart < range.start ? candidateStart : range.start,
    end: candidateEnd > range.end ? candidateEnd : range.end,
  };
}

/**
 * Visible time axis for the occupancy (Belegungs) calendar: the earliest
 * planting date and the latest relevant date (harvest end, falling back to the
 * harvest date) across every scheduled plan of the active season. Computed
 * globally so all rows share the same columns. The planting date itself stays
 * clamped to the season boundary elsewhere; only the end of the axis may reach
 * past the season end. Returns null when the season has no scheduled plans —
 * the caller then falls back and the existing empty state renders.
 */
export function getOccupancyCalendarRange(plantingPlans: PlantingPlan[]): CalendarDateRange | null {
  let range: { start: Date; end: Date } | null = null;
  plantingPlans.forEach((plan) => {
    if (!isScheduledPlantingPlan(plan)) {
      return;
    }
    const plantingDate = parseDateString(plan.planting_date);
    if (Number.isNaN(plantingDate.getTime())) {
      return;
    }
    const harvestEndSource = plan.harvest_end_date || plan.harvest_date;
    const harvestEndDate = parseDateString(harvestEndSource);
    const rangeEnd = !Number.isNaN(harvestEndDate.getTime()) && harvestEndDate > plantingDate
      ? harvestEndDate
      : plantingDate;
    range = extendRange(range, plantingDate, rangeEnd);
  });
  return range;
}

/**
 * Visible time axis for the seedling (Anzucht) calendar: the earliest
 * propagation start and the latest transplant date across every pre-cultivation
 * plan of the active season. Kept separate from the occupancy range because
 * propagation starts before the planting date. Returns null when there are no
 * pre-cultivation plans.
 */
export function getSeedlingCalendarRange(
  plantingPlans: PlantingPlan[],
  cultures: Culture[],
): CalendarDateRange | null {
  const cultureById = buildCultureById(cultures);
  let range: { start: Date; end: Date } | null = null;
  plantingPlans.forEach((plan) => {
    const preCultivation = getPlanPreCultivationDates(plan, cultureById);
    if (!preCultivation) {
      return;
    }
    range = extendRange(range, preCultivation.propagationStartDate, preCultivation.transplantDate);
  });
  return range;
}

export function formatCultureDisplayLabel(cultureName?: string | null, variety?: string | null): string {
  const normalizedCultureName = cultureName?.trim();
  const normalizedVariety = variety?.trim();

  if (normalizedCultureName && normalizedVariety) {
    return `${normalizedCultureName} (${normalizedVariety})`;
  }
  return normalizedCultureName || normalizedVariety || 'Unbekannte Kultur';
}

function getPlanCultureDisplayName(plan: Pick<PlantingPlan, 'culture_display_name' | 'culture_name'>): string {
  return getCultureDisplayName(plan);
}

export function formatSeedlingTooltipTitle(task: Pick<GanttTask, 'cultureName' | 'cultureVariety' | 'name'>): string {
  return formatCultureDisplayLabel(task.cultureName || task.name, task.cultureVariety);
}

export function formatGanttDate(value: Date): string {
  return value.toLocaleDateString('de-DE');
}

export function formatAreaSquareMeters(value: number): string {
  return `${formatLocalizedNumber(value, 'de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
}

export function formatPlantCount(value: number): string {
  return formatLocalizedNumber(value, 'de-DE', { maximumFractionDigits: 0 });
}

function formatCultureLabel(culture?: Culture, fallbackName?: string | null, fallbackVariety?: string | null): string {
  if (!culture) {
    return fallbackName || 'Unbekannte Kultur';
  }
  return formatCultureDisplayName({
    ...culture,
    culture_display_name: culture.culture_display_name || fallbackName,
    variety: fallbackVariety || culture.variety,
  });
}

export function getOccupancyTaskPhase(task: Pick<GanttTask, 'id'>): 'growth' | 'harvest' {
  return task.id.endsWith('-harvest') ? 'harvest' : 'growth';
}

export function buildOccupancyTooltipDetails(task: Pick<
  GanttTask,
  'id' | 'startDate' | 'harvestStartDate' | 'harvestEndDate' | 'areaUsage' | 'notes'
>): OccupancyTooltipDetail[] {
  const isHarvestTask = getOccupancyTaskPhase(task) === 'harvest';
  const hasHarvestRange = Boolean(
    task.harvestStartDate
    && task.harvestEndDate
    && task.harvestEndDate.getTime() > task.harvestStartDate.getTime(),
  );

  const details: Array<OccupancyTooltipDetail | null> = [
    !isHarvestTask
      ? { labelKey: 'plantingDate', value: formatGanttDate(task.startDate) }
      : null,
    task.harvestStartDate && !hasHarvestRange
      ? { labelKey: 'harvestDate', value: formatGanttDate(task.harvestStartDate) }
      : null,
    task.harvestStartDate && hasHarvestRange
      ? { labelKey: 'firstHarvest', value: formatGanttDate(task.harvestStartDate) }
      : null,
    task.harvestEndDate && hasHarvestRange
      ? { labelKey: 'lastHarvest', value: formatGanttDate(task.harvestEndDate) }
      : null,
    typeof task.areaUsage === 'number'
      ? { labelKey: 'areaUsage', value: formatAreaSquareMeters(task.areaUsage) }
      : null,
    task.notes?.trim()
      ? { labelKey: 'notes', value: task.notes.trim() }
      : null,
  ];

  return details.filter((detail): detail is OccupancyTooltipDetail => detail !== null);
}

export function buildSeedlingTooltipDetails(task: Pick<
  GanttTask,
  | 'propagationStartDate'
  | 'transplantDate'
  | 'propagationDurationDays'
  | 'plantsCount'
  | 'plantingPlanCount'
  | 'involvedLocationNames'
>): SeedlingTooltipDetail[] {
  const details: Array<SeedlingTooltipDetail | null> = [
    task.propagationStartDate
      ? { labelKey: 'propagationStart', value: formatGanttDate(task.propagationStartDate) }
      : null,
    task.transplantDate
      ? { labelKey: 'transplantDate', value: formatGanttDate(task.transplantDate) }
      : null,
    typeof task.propagationDurationDays === 'number'
      ? { labelKey: 'propagationDuration', value: `${task.propagationDurationDays}` }
      : null,
    typeof task.plantsCount === 'number' && task.plantsCount > 0
      ? { labelKey: 'totalPlantsCount', value: formatPlantCount(task.plantsCount) }
      : null,
    typeof task.plantingPlanCount === 'number' && task.plantingPlanCount > 0
      ? { labelKey: 'plantingPlanCount', value: formatPlantCount(task.plantingPlanCount) }
      : null,
    task.involvedLocationNames && task.involvedLocationNames.length > 0
      ? { labelKey: 'involvedLocations', value: task.involvedLocationNames.join(', ') }
      : null,
  ];

  return details.filter((detail): detail is SeedlingTooltipDetail => detail !== null);
}

export function buildFieldOccupancyTaskGroups({
  locations,
  fields,
  beds,
  plantingPlans,
  cultures,
}: BuildTaskGroupsArgs): GanttTaskGroup[] {
  if (!locations.length || !fields.length || !beds.length || !plantingPlans.length) {
    return [];
  }

  const candidates: OccupancyBedGroupCandidate[] = [];
  const plansByBed = new Map<number, ScheduledPlantingPlan[]>();

  plantingPlans.forEach((plan) => {
    if (!isScheduledPlantingPlan(plan)) {
      return;
    }
    const bedPlans = plansByBed.get(plan.bed) ?? [];
    bedPlans.push(plan);
    plansByBed.set(plan.bed, bedPlans);
  });

  const bedsByField = beds.reduce<Record<number, Bed[]>>((accumulator, bed) => {
    const fieldId = bed.field;
    accumulator[fieldId] = accumulator[fieldId] ?? [];
    accumulator[fieldId].push(bed);
    return accumulator;
  }, {});

  const fieldsByLocation = fields.reduce<Record<number, Field[]>>((accumulator, field) => {
    const locationId = field.location;
    accumulator[locationId] = accumulator[locationId] ?? [];
    accumulator[locationId].push(field);
    return accumulator;
  }, {});

  locations.forEach((location) => {
    const locationId = location.id;
    if (!locationId) {
      return;
    }

    const locationFields = fieldsByLocation[locationId] ?? [];
    locationFields.forEach((field) => {
      const fieldId = field.id;
      if (!fieldId) {
        return;
      }

      const fieldBeds = bedsByField[fieldId] ?? [];
      fieldBeds.forEach((bed) => {
        const bedId = bed.id;
        if (!bedId) {
          return;
        }

        const bedPlans = plansByBed.get(bedId) ?? [];

        if (bedPlans.length === 0) {
          return;
        }

        const tasks: GanttTask[] = [];
        bedPlans.forEach((plan) => {
          const plantingDate = parseDateString(plan.planting_date);
          const harvestStartDate = parseDateString(plan.harvest_date);
          const harvestEndDate = plan.harvest_end_date
            ? parseDateString(plan.harvest_end_date)
            : harvestStartDate;
          const cultureDisplayName = getPlanCultureDisplayName(plan);
          const baseColor = getCultureColor(cultures, plan.culture, cultureDisplayName, plan.culture_display_color);
          const phaseColors = getGanttPhaseColors(baseColor);
          const cultureLabel = formatCultureDisplayLabel(
            cultureDisplayName || `Culture ${plan.culture}`,
            plan.culture_variety,
          );

          tasks.push({
            id: `plan-${plan.id}-growth`,
            name: cultureLabel,
            startDate: plantingDate,
            endDate: harvestStartDate,
            color: phaseColors.growth,
            percent: 100,
            plantingPlanId: plan.id,
            cultureName: cultureDisplayName || undefined,
            cultureVariety: plan.culture_variety ?? undefined,
            areaUsage: plan.area_usage_sqm ? Number(plan.area_usage_sqm) : undefined,
            notes: plan.notes,
            harvestStartDate,
            harvestEndDate,
          });

          if (harvestEndDate > harvestStartDate) {
            tasks.push({
              id: `plan-${plan.id}-harvest`,
              name: `${cultureLabel} (Ernte)`,
              startDate: harvestStartDate,
              endDate: harvestEndDate,
              color: phaseColors.harvest,
              percent: 100,
              plantingPlanId: plan.id,
              cultureName: cultureDisplayName || undefined,
              cultureVariety: plan.culture_variety ?? undefined,
              areaUsage: plan.area_usage_sqm ? Number(plan.area_usage_sqm) : undefined,
              notes: plan.notes,
              harvestStartDate,
              harvestEndDate,
            });
          }
        });

        candidates.push({
          id: `bed-${bedId}`,
          tasks,
          locationId,
          fieldId,
          bedId,
          locationName: location.name,
          fieldName: field.name,
          bedName: bed.name,
          area: bed.area_sqm ? Number(bed.area_sqm) : undefined,
        });
      });
    });
  });

  const usedLocationCount = new Set(candidates.map((candidate) => candidate.locationId))
    .size;
  const includeLocationInHierarchy = usedLocationCount > 1;

  return candidates.map((candidate) => {
    const hierarchyPath = includeLocationInHierarchy
      ? [candidate.locationName, candidate.fieldName, candidate.bedName]
      : [candidate.fieldName, candidate.bedName];
    const hierarchyLabel = hierarchyPath.join(' / ');

    return {
      id: candidate.id,
      name: hierarchyLabel,
      description: hierarchyLabel,
      hierarchyPath,
      tasks: candidate.tasks,
      locationId: candidate.locationId,
      fieldId: candidate.fieldId,
      bedId: candidate.bedId,
      area: candidate.area,
    };
  });
}

export type OccupancyHierarchyNodeType = 'location' | 'field' | 'bed';

/**
 * A single row of the Standort -> Parzelle -> Beet tree, built as a flat
 * list with parent references (see frontend/src/components/hierarchy/utils/treeRows.ts
 * for the generic flatten/expand logic this feeds into) rather than the
 * older hierarchyPath breadcrumb-per-leaf convention.
 */
export interface OccupancyHierarchyNode {
  id: string;
  parentId: string | null;
  type: OccupancyHierarchyNodeType;
  name: string;
  locationId: number;
  fieldId?: number;
  bedId?: number;
  tasks: GanttTask[];
  area?: number;
  /** Total descendant bed count (1 for bed nodes themselves). */
  bedCount: number;
  /** Descendant beds that have at least one planting plan. */
  occupiedBedCount: number;
  /** Descendant planting plan count (growth tasks only, harvest duplicates excluded). */
  planCount: number;
}

/**
 * Builds the full Standort -> Parzelle -> Beet tree for the occupancy
 * calendar, including beds without any planting plan (unlike
 * buildFieldOccupancyTaskGroups, which only emits occupied beds as flat
 * rows). Location and Field are always their own nodes, regardless of
 * count, so the tree structure is consistent rather than collapsing a
 * single location the way the old hierarchyPath label did.
 */
export function buildFieldOccupancyHierarchy({
  locations,
  fields,
  beds,
  plantingPlans,
  cultures,
}: BuildTaskGroupsArgs): OccupancyHierarchyNode[] {
  if (!locations.length) {
    return [];
  }

  const plansByBed = new Map<number, ScheduledPlantingPlan[]>();

  plantingPlans.forEach((plan) => {
    if (!isScheduledPlantingPlan(plan)) {
      return;
    }
    const bedPlans = plansByBed.get(plan.bed) ?? [];
    bedPlans.push(plan);
    plansByBed.set(plan.bed, bedPlans);
  });

  const bedsByField = beds.reduce<Record<number, Bed[]>>((accumulator, bed) => {
    const fieldId = bed.field;
    accumulator[fieldId] = accumulator[fieldId] ?? [];
    accumulator[fieldId].push(bed);
    return accumulator;
  }, {});

  const fieldsByLocation = fields.reduce<Record<number, Field[]>>((accumulator, field) => {
    const locationId = field.location;
    accumulator[locationId] = accumulator[locationId] ?? [];
    accumulator[locationId].push(field);
    return accumulator;
  }, {});

  const buildBedTasks = (bedPlans: ScheduledPlantingPlan[]): GanttTask[] => {
    const tasks: GanttTask[] = [];
    bedPlans.forEach((plan) => {
      const plantingDate = parseDateString(plan.planting_date);
      const harvestStartDate = parseDateString(plan.harvest_date);
      const harvestEndDate = plan.harvest_end_date
        ? parseDateString(plan.harvest_end_date)
        : harvestStartDate;
      const cultureDisplayName = getPlanCultureDisplayName(plan);
      const baseColor = getCultureColor(cultures, plan.culture, cultureDisplayName, plan.culture_display_color);
      const phaseColors = getGanttPhaseColors(baseColor);
      const cultureLabel = formatCultureDisplayLabel(
        cultureDisplayName || `Culture ${plan.culture}`,
        plan.culture_variety,
      );

      tasks.push({
        id: `plan-${plan.id}-growth`,
        name: cultureLabel,
        startDate: plantingDate,
        endDate: harvestStartDate,
        color: phaseColors.growth,
        percent: 100,
        plantingPlanId: plan.id,
        cultureName: cultureDisplayName || undefined,
        cultureVariety: plan.culture_variety ?? undefined,
        areaUsage: plan.area_usage_sqm ? Number(plan.area_usage_sqm) : undefined,
        notes: plan.notes,
        harvestStartDate,
        harvestEndDate,
      });

      if (harvestEndDate > harvestStartDate) {
        tasks.push({
          id: `plan-${plan.id}-harvest`,
          name: `${cultureLabel} (Ernte)`,
          startDate: harvestStartDate,
          endDate: harvestEndDate,
          color: phaseColors.harvest,
          percent: 100,
          plantingPlanId: plan.id,
          cultureName: cultureDisplayName || undefined,
          cultureVariety: plan.culture_variety ?? undefined,
          areaUsage: plan.area_usage_sqm ? Number(plan.area_usage_sqm) : undefined,
          notes: plan.notes,
          harvestStartDate,
          harvestEndDate,
        });
      }
    });
    return tasks;
  };

  const nodes: OccupancyHierarchyNode[] = [];

  locations.forEach((location) => {
    const locationId = location.id;
    if (!locationId) {
      return;
    }

    const locationNodeId = `location-${locationId}`;
    const locationNode: OccupancyHierarchyNode = {
      id: locationNodeId,
      parentId: null,
      type: 'location',
      name: location.name,
      locationId,
      tasks: [],
      bedCount: 0,
      occupiedBedCount: 0,
      planCount: 0,
    };
    nodes.push(locationNode);

    const locationFields = fieldsByLocation[locationId] ?? [];
    locationFields.forEach((field) => {
      const fieldId = field.id;
      if (!fieldId) {
        return;
      }

      const fieldNodeId = `field-${fieldId}`;
      const fieldNode: OccupancyHierarchyNode = {
        id: fieldNodeId,
        parentId: locationNodeId,
        type: 'field',
        name: field.name,
        locationId,
        fieldId,
        tasks: [],
        bedCount: 0,
        occupiedBedCount: 0,
        planCount: 0,
      };
      nodes.push(fieldNode);

      const fieldBeds = bedsByField[fieldId] ?? [];
      fieldBeds.forEach((bed) => {
        const bedId = bed.id;
        if (!bedId) {
          return;
        }

        const bedPlans = plansByBed.get(bedId) ?? [];
        const tasks = buildBedTasks(bedPlans);
        const isOccupied = bedPlans.length > 0;

        nodes.push({
          id: `bed-${bedId}`,
          parentId: fieldNodeId,
          type: 'bed',
          name: bed.name,
          locationId,
          fieldId,
          bedId,
          tasks,
          area: bed.area_sqm ? Number(bed.area_sqm) : undefined,
          bedCount: 1,
          occupiedBedCount: isOccupied ? 1 : 0,
          planCount: bedPlans.length,
        });

        fieldNode.bedCount += 1;
        fieldNode.occupiedBedCount += isOccupied ? 1 : 0;
        fieldNode.planCount += bedPlans.length;
        locationNode.bedCount += 1;
        locationNode.occupiedBedCount += isOccupied ? 1 : 0;
        locationNode.planCount += bedPlans.length;
      });
    });
  });

  return nodes;
}

export function buildSeedlingTaskGroups({
  plantingPlans,
  cultures,
}: BuildTaskGroupsArgs): GanttTaskGroup[] {
  if (!plantingPlans.length) {
    return [];
  }

  const cultureById = buildCultureById(cultures);

  const groupsByCulture = new Map<string, GanttTaskGroup>();
  const aggregatedTasksByKey = new Map<string, GanttTask>();

  plantingPlans.forEach((plan) => {
    const preCultivation = getPlanPreCultivationDates(plan, cultureById);
    if (!preCultivation) {
      return;
    }
    const { propagationStartDate, transplantDate, propagationDurationDays } = preCultivation;
    const culture = plan.culture ? cultureById.get(plan.culture) : undefined;

    const cultureDisplayName = getPlanCultureDisplayName(plan);
    const cultureLabel = culture
      ? formatCultureLabel(culture, cultureDisplayName || null, plan.culture_variety)
      : formatCultureDisplayLabel(cultureDisplayName || `Kultur ${plan.culture}`, plan.culture_variety);
    const groupId = `culture-${plan.culture}`;
    const group = groupsByCulture.get(groupId) ?? {
      id: groupId,
      name: cultureLabel,
      tasks: [],
    };
    const aggregateKey = [
      plan.culture,
      formatIsoDate(propagationStartDate),
      formatIsoDate(transplantDate),
    ].join('|');
    const plantsCount = typeof plan.plants_count === 'number' ? plan.plants_count : null;
    const existingTask = aggregatedTasksByKey.get(aggregateKey);

    if (existingTask) {
      existingTask.plantingPlanCount = (existingTask.plantingPlanCount ?? 0) + 1;
      if (typeof plantsCount === 'number') {
        existingTask.plantsCount = (existingTask.plantsCount ?? 0) + plantsCount;
      }
      return;
    }

    const task: GanttTask = {
      id: `seedling-${plan.culture}-${formatIsoDate(propagationStartDate)}-${formatIsoDate(transplantDate)}`,
      name: cultureLabel,
      startDate: propagationStartDate,
      endDate: transplantDate,
      color: getCultureColor(cultures, plan.culture, cultureLabel, plan.culture_display_color),
      percent: 100,
      plantingPlanId: plan.id,
      cultureName: cultureDisplayName || culture?.name || cultureLabel,
      cultureVariety: culture?.variety || plan.culture_variety || undefined,
      propagationStartDate,
      propagationDurationDays,
      transplantDate,
      plantsCount,
      plantingPlanCount: 1,
    };

    group.tasks.push(task);
    aggregatedTasksByKey.set(aggregateKey, task);
    groupsByCulture.set(groupId, group);
  });

  return [...groupsByCulture.values()]
    .map((group) => ({
      ...group,
      tasks: [...group.tasks].sort((left, right) => left.startDate.getTime() - right.startDate.getTime()),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, 'de'));
}
