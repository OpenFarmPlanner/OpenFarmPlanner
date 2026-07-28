import { describe, expect, it, vi } from 'vitest';
import type { TFunction } from 'i18next';
import i18n from '../i18n/config';
import { createCulturesCommandSpecs } from '../pages/culturesCommandSpecs';

function buildOptions(overrides: Partial<Parameters<typeof createCulturesCommandSpecs>[0]> = {}) {
  return {
    // Command labels and keywords follow the UI language.
    t: i18n.getFixedT('de') as TFunction,
    cultures: [],
    focusSearch: vi.fn(),
    goToRelativeCulture: vi.fn(),
    handleCreatePlantingPlan: vi.fn(),
    handleDelete: vi.fn(),
    handleEdit: vi.fn(),
    handleExportAllCultures: vi.fn(),
    handleExportCurrentCulture: vi.fn(),
    handleImportFileTrigger: vi.fn(),
    ...overrides,
  };
}

describe('createCulturesCommandSpecs', () => {
  it('registers a culture.focusSearch command bound to /', () => {
    const options = buildOptions();
    const commands = createCulturesCommandSpecs(options);
    const focusSearchCommand = commands.find((command) => command.id === 'culture.focusSearch');

    expect(focusSearchCommand).toBeDefined();
    expect(focusSearchCommand?.keys).toEqual({ key: '/' });
    expect(focusSearchCommand?.shortcutHint).toBe('/');
    expect(focusSearchCommand?.isEnabled?.()).toBe(true);
    expect(focusSearchCommand?.label).toBe('Kultursuche fokussieren (/)');

    focusSearchCommand?.action();
    expect(options.focusSearch).toHaveBeenCalledTimes(1);
  });
});
