import type { Bed, Culture, Field, Location, PlantingPlan } from '../api/types';
import { addUtcDays, formatIsoDate, parseIsoDate } from '../utils/isoDate';

export type DerivedTaskType =
  | 'sowing'
  | 'planting'
  | 'propagationStart'
  | 'harvestStart';

export interface DerivedLocationTask {
  type: DerivedTaskType;
  date: string;
  locationId: number;
  planId?: number;
  cultureName?: string;
  bedName?: string;
  fieldName?: string;
}

const DIRECT_SOWING = 'direct_sowing';
const PRE_CULTIVATION = 'pre_cultivation';

const isDirectSowingPlan = (plan: PlantingPlan, culture?: Culture): boolean => {
  const planType = plan.cultivation_type || plan.culture_cultivation_type;
  if (planType === DIRECT_SOWING) return true;
  if (planType === PRE_CULTIVATION) return false;

  const supported = plan.culture_cultivation_types ?? culture?.cultivation_types ?? [];
  if (supported.includes(DIRECT_SOWING) && !supported.includes(PRE_CULTIVATION)) {
    return true;
  }
  return false;
};

export function deriveLocationTasks({
  locations,
  fields,
  beds,
  plantingPlans,
  cultures,
  today = new Date(),
}: {
  locations: Location[];
  fields: Field[];
  beds: Bed[];
  plantingPlans: PlantingPlan[];
  cultures: Culture[];
  today?: Date;
}): Record<number, DerivedLocationTask[]> {
  const locationIds = new Set(locations.map((location) => location.id).filter((id): id is number => typeof id === 'number'));
  const fieldById = new Map(fields.filter((field): field is Field & { id: number } => typeof field.id === 'number').map((field) => [field.id, field]));
  const bedById = new Map(beds.filter((bed): bed is Bed & { id: number } => typeof bed.id === 'number').map((bed) => [bed.id, bed]));
  const cultureById = new Map(cultures.filter((culture): culture is Culture & { id: number } => typeof culture.id === 'number').map((culture) => [culture.id, culture]));
  const byLocation: Record<number, DerivedLocationTask[]> = {};
  const dedupe = new Set<string>();
  const todayIso = formatIsoDate(today);

  const pushTask = (task: DerivedLocationTask): void => {
    if (task.date < todayIso) return;
    const key = `${task.locationId}:${task.planId ?? 'na'}:${task.type}:${task.date}`;
    if (dedupe.has(key)) return;
    dedupe.add(key);
    byLocation[task.locationId] = byLocation[task.locationId] ?? [];
    byLocation[task.locationId].push(task);
  };

  plantingPlans.forEach((plan) => {
    if (!plan.bed || !plan.culture) return;
    const bed = bedById.get(plan.bed);
    if (!bed) return;
    const field = fieldById.get(bed.field);
    if (!field || !locationIds.has(field.location)) return;
    const plantingDate = parseIsoDate(plan.planting_date);
    if (!plantingDate) return;
    const culture = cultureById.get(plan.culture);
    const direct = isDirectSowingPlan(plan, culture);
    const baseTaskType: DerivedTaskType = direct ? 'sowing' : 'planting';

    pushTask({
      type: baseTaskType,
      date: formatIsoDate(plantingDate),
      locationId: field.location,
      planId: plan.id,
      cultureName: plan.culture_name || culture?.name,
      bedName: plan.bed_name || bed.name,
      fieldName: field.name,
    });

    const propagationDuration = plan.culture_propagation_duration_days ?? culture?.propagation_duration_days ?? null;
    if (propagationDuration && propagationDuration > 0) {
      pushTask({
        type: 'propagationStart',
        date: formatIsoDate(addUtcDays(plantingDate, -propagationDuration)),
        locationId: field.location,
        planId: plan.id,
        cultureName: plan.culture_name || culture?.name,
        bedName: plan.bed_name || bed.name,
        fieldName: field.name,
      });
    }

    const growthDuration = culture?.growth_duration_days ?? null;
    if (growthDuration && growthDuration > 0) {
      pushTask({
        type: 'harvestStart',
        date: formatIsoDate(addUtcDays(plantingDate, growthDuration)),
        locationId: field.location,
        planId: plan.id,
        cultureName: plan.culture_name || culture?.name,
        bedName: plan.bed_name || bed.name,
        fieldName: field.name,
      });
    }
  });

  Object.values(byLocation).forEach((tasks) => {
    tasks.sort((left, right) => left.date.localeCompare(right.date));
  });
  return byLocation;
}
