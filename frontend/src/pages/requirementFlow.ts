export type CultivationPlanRequirementStep = 'fields' | 'beds' | 'crops' | null;
export type ProjectSetupStep = 'fields' | 'beds' | 'crops' | 'plans';

export interface ProjectSetupAction {
  labelKey: string;
  to: string;
}

export interface TranslatedProjectSetupAction {
  label: string;
  to: string;
}

type Translate = (key: string) => string;

const PROJECT_SETUP_ACTIONS: Record<ProjectSetupStep, ProjectSetupAction> = {
  fields: { labelKey: 'common:setupActions.createField', to: '/app/fields-beds?action=add-parcel' },
  beds: { labelKey: 'common:setupActions.openAreas', to: '/app/fields-beds' },
  crops: { labelKey: 'common:setupActions.createCrop', to: '/app/crops?create=true' },
  plans: { labelKey: 'common:setupActions.createPlan', to: '/app/planting-plans?create=true' },
};

const CROP_SETUP_ACTIONS: ProjectSetupAction[] = [
  { labelKey: 'common:setupActions.openCropLibrary', to: '/app/crops?library=true' },
  PROJECT_SETUP_ACTIONS.crops,
];

interface CultivationPlanRequirementState {
  hasFields: boolean;
  hasBeds: boolean;
  hasCrops: boolean;
}

interface ProjectSetupState {
  hasFields: boolean;
  hasBeds: boolean;
  hasCrops: boolean;
  hasPlans: boolean;
}

export function getFirstMissingProjectSetupStep(state: ProjectSetupState): ProjectSetupStep | null {
  if (!state.hasFields) return 'fields';
  if (!state.hasBeds) return 'beds';
  if (!state.hasCrops) return 'crops';
  if (!state.hasPlans) return 'plans';
  return null;
}

export function getProjectSetupAction(step: ProjectSetupStep): ProjectSetupAction {
  return PROJECT_SETUP_ACTIONS[step];
}

export function getProjectSetupActions(step: ProjectSetupStep): ProjectSetupAction[] {
  if (step === 'crops') {
    return CROP_SETUP_ACTIONS;
  }
  return [getProjectSetupAction(step)];
}

export function getTranslatedProjectSetupAction(
  step: ProjectSetupStep,
  translate: Translate,
): TranslatedProjectSetupAction {
  const action = getProjectSetupAction(step);
  return { label: translate(action.labelKey), to: action.to };
}

export function getTranslatedProjectSetupActions(
  step: ProjectSetupStep,
  translate: Translate,
): TranslatedProjectSetupAction[] {
  return getProjectSetupActions(step).map((action) => ({
    label: translate(action.labelKey),
    to: action.to,
  }));
}

export function getFirstMissingCultivationPlanRequirement(
  state: CultivationPlanRequirementState,
): CultivationPlanRequirementStep {
  if (!state.hasFields) return 'fields';
  if (!state.hasBeds) return 'beds';
  if (!state.hasCrops) return 'crops';
  return null;
}
