import { describe, expect, it } from 'vitest';
import {
  getFirstMissingCultivationPlanRequirement,
  getFirstMissingProjectSetupStep,
  getProjectSetupAction,
  getProjectSetupActions,
  getTranslatedProjectSetupActions,
} from '../pages/requirementFlow';

describe('getFirstMissingCultivationPlanRequirement', () => {
  it('returns beds when beds are missing but location and field exist', () => {
    expect(getFirstMissingCultivationPlanRequirement({
      hasFields: true,
      hasBeds: false,
      hasCrops: true,
    })).toBe('beds');
  });

  it('returns null when all prerequisites are fulfilled', () => {
    expect(getFirstMissingCultivationPlanRequirement({
      hasFields: true,
      hasBeds: true,
      hasCrops: true,
    })).toBeNull();
  });
});

describe('project setup actions', () => {
  it('starts setup with fields before beds', () => {
    expect(getFirstMissingProjectSetupStep({
      hasFields: false,
      hasBeds: false,
      hasCrops: false,
      hasPlans: false,
    })).toBe('fields');
  });

  it('uses the shared add-field route that opens the fields-beds page', () => {
    expect(getProjectSetupAction('fields')).toEqual({
      labelKey: 'common:setupActions.createField',
      to: '/app/fields-beds?action=add-parcel',
    });
  });

  it('uses the shared beds step action that opens the fields-beds page', () => {
    expect(getProjectSetupAction('beds')).toEqual({
      labelKey: 'common:setupActions.openAreas',
      to: '/app/fields-beds',
    });
  });

  it('orders crop setup actions with the library first', () => {
    expect(getProjectSetupActions('crops')).toEqual([
      {
        labelKey: 'common:setupActions.openCropLibrary',
        to: '/app/crops?library=true',
      },
      {
        labelKey: 'common:setupActions.createCrop',
        to: '/app/crops?create=true',
      },
    ]);
  });

  it('translates setup actions while preserving routes', () => {
    expect(getTranslatedProjectSetupActions('crops', (key) => `translated:${key}`)).toEqual([
      {
        label: 'translated:common:setupActions.openCropLibrary',
        to: '/app/crops?library=true',
      },
      {
        label: 'translated:common:setupActions.createCrop',
        to: '/app/crops?create=true',
      },
    ]);
  });
});
