import { describe, expect, it, vi } from 'vitest';
import type { TFunction } from 'i18next';
import i18n from '../i18n/config';
import { createCropsCommandSpecs } from '../pages/cropsCommandSpecs';

function buildOptions(overrides: Partial<Parameters<typeof createCropsCommandSpecs>[0]> = {}) {
  return {
    // Command labels and keywords follow the UI language.
    t: i18n.getFixedT('de') as TFunction,
    crops: [],
    focusSearch: vi.fn(),
    goToRelativeCrop: vi.fn(),
    handleCreatePlantingPlan: vi.fn(),
    handleDelete: vi.fn(),
    handleEdit: vi.fn(),
    handleExportAllCrops: vi.fn(),
    handleExportCurrentCrop: vi.fn(),
    handleImportFileTrigger: vi.fn(),
    ...overrides,
  };
}

describe('createCropsCommandSpecs', () => {
  it('registers a crop.focusSearch command bound to /', () => {
    const options = buildOptions();
    const commands = createCropsCommandSpecs(options);
    const focusSearchCommand = commands.find((command) => command.id === 'crop.focusSearch');

    expect(focusSearchCommand).toBeDefined();
    expect(focusSearchCommand?.keys).toEqual({ key: '/' });
    expect(focusSearchCommand?.shortcutHint).toBe('/');
    expect(focusSearchCommand?.isEnabled?.()).toBe(true);
    expect(focusSearchCommand?.label).toBe('Kultursuche fokussieren (/)');

    focusSearchCommand?.action();
    expect(options.focusSearch).toHaveBeenCalledTimes(1);
  });
});
