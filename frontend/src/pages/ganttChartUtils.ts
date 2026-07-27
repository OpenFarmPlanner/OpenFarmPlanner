import type { Bed, Culture, Field, Location, PlantingPlan } from '../api/types';
import { formatLocalizedNumber } from '../utils/numberLocalization';
import { addUtcDays, formatIsoDate, parseIsoDate } from '../utils/isoDate';

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
  emptyRowLabel?: string;
  rowHeightOverride?: number;
}

interface BuildTaskGroupsArgs {
  locations: Location[];
  fields: Field[];
  beds: Bed[];
  plantingPlans: PlantingPlan[];
  cultures: Culture[];
  displayYear: number;
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

function getVisibleYearInterval(displayYear: number): { start: Date; end: Date } {
  return {
    start: new Date(displayYear, 0, 1),
    end: new Date(displayYear, 11, 31, 23, 59, 59),
  };
}

export function formatCultureDisplayLabel(cultureName?: string | null, variety?: string | null): string {
  const normalizedCultureName = cultureName?.trim();
  const normalizedVariety = variety?.trim();

  if (normalizedCultureName && normalizedVariety) {
    return `${normalizedCultureName} (${normalizedVariety})`;
  }
  return normalizedCultureName || normalizedVariety || 'Unbekannte Kultur';
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

function formatCultureLabel(culture?: Culture, fallbackName?: string | null): string {
  if (!culture) {
    return fallbackName || 'Unbekannte Kultur';
  }
  return formatCultureDisplayLabel(culture.name, culture.variety);
}

export function buildOccupancyTooltipDetails(task: Pick<
  GanttTask,
  'id' | 'startDate' | 'harvestStartDate' | 'harvestEndDate' | 'areaUsage' | 'notes'
>): OccupancyTooltipDetail[] {
  const isHarvestTask = task.id.endsWith('-harvest');
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
  displayYear,
}: BuildTaskGroupsArgs): GanttTaskGroup[] {
  if (!locations.length || !fields.length || !beds.length || !plantingPlans.length) {
    return [];
  }

  const candidates: OccupancyBedGroupCandidate[] = [];
  const { start: visStart, end: visEnd } = getVisibleYearInterval(displayYear);
  const plansByBed = new Map<number, ScheduledPlantingPlan[]>();

  plantingPlans.forEach((plan) => {
    if (!isScheduledPlantingPlan(plan)) {
      return;
    }
    const plantingDate = parseDateString(plan.planting_date);
    const harvestDate = parseDateString(plan.harvest_date);
    if (harvestDate < visStart || plantingDate > visEnd) {
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
          const baseColor = getCultureColor(cultures, plan.culture, plan.culture_name || '', plan.culture_display_color);
          const cultureLabel = formatCultureDisplayLabel(
            plan.culture_name || `Culture ${plan.culture}`,
            plan.culture_variety,
          );

          tasks.push({
            id: `plan-${plan.id}-growth`,
            name: cultureLabel,
            startDate: plantingDate,
            endDate: harvestStartDate,
            color: baseColor,
            percent: 100,
            plantingPlanId: plan.id,
            cultureName: plan.culture_name ?? undefined,
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
              color: baseColor.startsWith('#') ? `${baseColor}CC` : baseColor,
              percent: 100,
              plantingPlanId: plan.id,
              cultureName: plan.culture_name ?? undefined,
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
  displayYear,
}: BuildTaskGroupsArgs): OccupancyHierarchyNode[] {
  if (!locations.length) {
    return [];
  }

  const { start: visStart, end: visEnd } = getVisibleYearInterval(displayYear);
  const plansByBed = new Map<number, ScheduledPlantingPlan[]>();

  plantingPlans.forEach((plan) => {
    if (!isScheduledPlantingPlan(plan)) {
      return;
    }
    const plantingDate = parseDateString(plan.planting_date);
    const harvestDate = parseDateString(plan.harvest_date);
    if (harvestDate < visStart || plantingDate > visEnd) {
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
      const baseColor = getCultureColor(cultures, plan.culture, plan.culture_name || '', plan.culture_display_color);
      const cultureLabel = formatCultureDisplayLabel(
        plan.culture_name || `Culture ${plan.culture}`,
        plan.culture_variety,
      );

      tasks.push({
        id: `plan-${plan.id}-growth`,
        name: cultureLabel,
        startDate: plantingDate,
        endDate: harvestStartDate,
        color: baseColor,
        percent: 100,
        plantingPlanId: plan.id,
        cultureName: plan.culture_name ?? undefined,
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
          color: baseColor.startsWith('#') ? `${baseColor}CC` : baseColor,
          percent: 100,
          plantingPlanId: plan.id,
          cultureName: plan.culture_name ?? undefined,
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
  displayYear,
}: BuildTaskGroupsArgs): GanttTaskGroup[] {
  if (!plantingPlans.length) {
    return [];
  }

  const { start: visStart, end: visEnd } = getVisibleYearInterval(displayYear);
  const cultureById = new Map<number, Culture>();
  cultures.forEach((culture) => {
    if (culture.id) {
      cultureById.set(culture.id, culture);
    }
  });

  const groupsByCulture = new Map<string, GanttTaskGroup>();
  const aggregatedTasksByKey = new Map<string, GanttTask>();

  plantingPlans.forEach((plan) => {
    if (!plan.id || !plan.culture || !plan.planting_date) {
      return;
    }

    const culture = cultureById.get(plan.culture);
    const propagationDurationDays = culture?.propagation_duration_days
      ?? plan.culture_propagation_duration_days
      ?? undefined;
    if (!propagationDurationDays || propagationDurationDays <= 0) {
      return;
    }

    const cultureCultivationType = culture?.cultivation_type || plan.culture_cultivation_type || '';
    const cultureCultivationTypes = culture?.cultivation_types || plan.culture_cultivation_types || [];
    const isPreCultivation = plan.cultivation_type === 'pre_cultivation'
      || (!plan.cultivation_type && (
        cultureCultivationType === 'pre_cultivation'
        || cultureCultivationTypes.includes('pre_cultivation')
      ));

    if (!isPreCultivation) {
      return;
    }

    const transplantDate = parseDateString(plan.planting_date);
    const propagationStartDate = addUtcDays(transplantDate, -propagationDurationDays);

    if (transplantDate < visStart || propagationStartDate > visEnd) {
      return;
    }

    const cultureLabel = culture
      ? formatCultureLabel(culture, plan.culture_name)
      : formatCultureDisplayLabel(plan.culture_name || `Kultur ${plan.culture}`, plan.culture_variety);
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
      cultureName: culture?.name || plan.culture_name || cultureLabel,
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
