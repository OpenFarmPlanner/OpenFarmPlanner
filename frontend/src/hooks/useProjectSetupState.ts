export interface ProjectSetupStateInput {
  fieldsCount: number;
  bedsCount: number;
  cropsCount: number;
  plantingPlansCount: number;
  suppliersCount?: number;
}

export interface ProjectSetupState {
  hasFields: boolean;
  hasBeds: boolean;
  hasCrops: boolean;
  hasPlantingPlans: boolean;
  hasSuppliers: boolean;
  missingForPlantingPlans: Array<'crops' | 'beds'>;
}

export const deriveProjectSetupState = (input: ProjectSetupStateInput): ProjectSetupState => {
  const hasFields = input.fieldsCount > 0;
  const hasBeds = input.bedsCount > 0;
  const hasCrops = input.cropsCount > 0;
  const hasPlantingPlans = input.plantingPlansCount > 0;
  const hasSuppliers = (input.suppliersCount ?? 0) > 0;
  const missingForPlantingPlans: Array<'crops' | 'beds'> = [];
  if (!hasCrops) missingForPlantingPlans.push('crops');
  if (!hasBeds) missingForPlantingPlans.push('beds');

  return {
    hasFields,
    hasBeds,
    hasCrops,
    hasPlantingPlans,
    hasSuppliers,
    missingForPlantingPlans,
  };
};
