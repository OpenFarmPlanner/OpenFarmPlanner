import type { TFunction } from 'i18next';

import type { Culture } from '../api/api';
import type { CommandSpec } from '../commands/types';
import { keywordList } from '../commands/keywordList';

export type CreateCulturesCommandSpecsOptions = {
  /** Command palette labels and search keywords follow the UI language. */
  t: TFunction;
  cultures: Culture[];
  focusSearch: () => void;
  goToRelativeCulture: (direction: 'next' | 'previous') => void;
  handleCreatePlantingPlan: () => void;
  handleDelete: (culture: Culture) => void;
  handleEdit: (culture: Culture) => void;
  handleExportAllCultures: () => void;
  handleExportCurrentCulture: () => void;
  handleImportFileTrigger: () => void;
  selectedCulture?: Culture;
  selectedCultureId?: number;
};

export function createCulturesCommandSpecs({
  t,
  cultures,
  focusSearch,
  goToRelativeCulture,
  handleCreatePlantingPlan,
  handleDelete,
  handleEdit,
  handleExportAllCultures,
  handleExportCurrentCulture,
  handleImportFileTrigger,
  selectedCulture,
  selectedCultureId,
}: CreateCulturesCommandSpecsOptions): CommandSpec[] {
  return [
    {
      id: 'culture.focusSearch',
      label: t('cultures:commands.focusSearch'),
      group: 'navigation',
      keywords: keywordList(t, 'cultures:commands.keywords.search'),
      shortcutHint: '/',
      keys: { key: '/' },
      contextTags: ['cultures'],
      isEnabled: () => true,
      action: focusSearch,
    },
    {
      id: 'culture.edit',
      label: t('cultures:commands.edit'),
      group: 'navigation',
      keywords: keywordList(t, 'cultures:commands.keywords.edit'),
      shortcutHint: 'Alt+E',
      keys: { alt: true, key: 'e' },
      contextTags: ['cultures'],
      isEnabled: () => Boolean(selectedCulture),
      action: () => {
        if (selectedCulture) {
          handleEdit(selectedCulture);
        }
      },
    },
    {
      id: 'culture.delete',
      label: t('cultures:commands.delete'),
      group: 'navigation',
      keywords: keywordList(t, 'cultures:commands.keywords.delete'),
      shortcutHint: 'Alt+Shift+D',
      keys: { alt: true, shift: true, key: 'd' },
      contextTags: ['cultures'],
      isEnabled: () => Boolean(selectedCulture),
      action: () => {
        if (selectedCulture) {
          handleDelete(selectedCulture);
        }
      },
    },
    {
      id: 'culture.exportCurrent',
      label: selectedCulture ? t('cultures:commands.exportCurrent') : t('cultures:commands.exportAllShort'),
      group: 'navigation',
      keywords: keywordList(t, 'cultures:commands.keywords.export'),
      shortcutHint: 'Alt+J',
      keys: { alt: true, key: 'j' },
      contextTags: ['cultures'],
      isEnabled: () => Boolean(selectedCulture),
      action: handleExportCurrentCulture,
    },
    {
      id: 'culture.exportAll',
      label: t('cultures:commands.exportAll'),
      group: 'navigation',
      keywords: keywordList(t, 'cultures:commands.keywords.exportAll'),
      shortcutHint: 'Alt+Shift+J',
      keys: { alt: true, shift: true, key: 'j' },
      contextTags: ['cultures'],
      isEnabled: () => true,
      action: handleExportAllCultures,
    },
    {
      id: 'culture.import',
      label: t('cultures:commands.import'),
      group: 'navigation',
      keywords: keywordList(t, 'cultures:commands.keywords.import'),
      shortcutHint: 'Alt+I',
      keys: { alt: true, key: 'i' },
      contextTags: ['cultures'],
      isEnabled: () => true,
      action: handleImportFileTrigger,
    },
    {
      id: 'culture.createPlan',
      label: t('cultures:commands.createPlan'),
      group: 'navigation',
      keywords: keywordList(t, 'cultures:commands.keywords.createPlan'),
      shortcutHint: 'Alt+P',
      keys: { alt: true, key: 'p' },
      contextTags: ['cultures'],
      isEnabled: () => Boolean(selectedCultureId),
      action: handleCreatePlantingPlan,
    },
    {
      id: 'culture.previous',
      label: t('cultures:commands.previous'),
      group: 'navigation',
      keywords: keywordList(t, 'cultures:commands.keywords.previous'),
      shortcutHint: 'Alt+Shift+←',
      keys: { alt: true, shift: true, key: 'ArrowLeft' },
      contextTags: ['cultures'],
      isEnabled: () => cultures.length > 1 && Boolean(selectedCultureId),
      action: () => goToRelativeCulture('previous'),
    },
    {
      id: 'culture.next',
      label: t('cultures:commands.next'),
      group: 'navigation',
      keywords: keywordList(t, 'cultures:commands.keywords.next'),
      shortcutHint: 'Alt+Shift+→',
      keys: { alt: true, shift: true, key: 'ArrowRight' },
      contextTags: ['cultures'],
      isEnabled: () => cultures.length > 1 && Boolean(selectedCultureId),
      action: () => goToRelativeCulture('next'),
    },
  ];
}
