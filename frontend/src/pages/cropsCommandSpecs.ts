import type { TFunction } from 'i18next';

import type { Crop } from '../api/api';
import type { CommandSpec } from '../commands/types';
import { keywordList } from '../commands/keywordList';

export type CreateCropsCommandSpecsOptions = {
  /** Command palette labels and search keywords follow the UI language. */
  t: TFunction;
  crops: Crop[];
  focusSearch: () => void;
  goToRelativeCrop: (direction: 'next' | 'previous') => void;
  handleCreatePlantingPlan: () => void;
  handleDelete: (crop: Crop) => void;
  handleEdit: (crop: Crop) => void;
  handleExportAllCrops: () => void;
  handleExportCurrentCrop: () => void;
  handleImportFileTrigger: () => void;
  selectedCrop?: Crop;
  selectedCropId?: number;
};

export function createCropsCommandSpecs({
  t,
  crops,
  focusSearch,
  goToRelativeCrop,
  handleCreatePlantingPlan,
  handleDelete,
  handleEdit,
  handleExportAllCrops,
  handleExportCurrentCrop,
  handleImportFileTrigger,
  selectedCrop,
  selectedCropId,
}: CreateCropsCommandSpecsOptions): CommandSpec[] {
  return [
    {
      id: 'crop.focusSearch',
      label: t('crops:commands.focusSearch'),
      group: 'navigation',
      keywords: keywordList(t, 'crops:commands.keywords.search'),
      shortcutHint: '/',
      keys: { key: '/' },
      contextTags: ['crops'],
      isEnabled: () => true,
      action: focusSearch,
    },
    {
      id: 'crop.edit',
      label: t('crops:commands.edit'),
      group: 'navigation',
      keywords: keywordList(t, 'crops:commands.keywords.edit'),
      shortcutHint: 'Alt+E',
      keys: { alt: true, key: 'e' },
      contextTags: ['crops'],
      isEnabled: () => Boolean(selectedCrop),
      action: () => {
        if (selectedCrop) {
          handleEdit(selectedCrop);
        }
      },
    },
    {
      id: 'crop.delete',
      label: t('crops:commands.delete'),
      group: 'navigation',
      keywords: keywordList(t, 'crops:commands.keywords.delete'),
      shortcutHint: 'Alt+Shift+D',
      keys: { alt: true, shift: true, key: 'd' },
      contextTags: ['crops'],
      isEnabled: () => Boolean(selectedCrop),
      action: () => {
        if (selectedCrop) {
          handleDelete(selectedCrop);
        }
      },
    },
    {
      id: 'crop.exportCurrent',
      label: selectedCrop ? t('crops:commands.exportCurrent') : t('crops:commands.exportAllShort'),
      group: 'navigation',
      keywords: keywordList(t, 'crops:commands.keywords.export'),
      shortcutHint: 'Alt+J',
      keys: { alt: true, key: 'j' },
      contextTags: ['crops'],
      isEnabled: () => Boolean(selectedCrop),
      action: handleExportCurrentCrop,
    },
    {
      id: 'crop.exportAll',
      label: t('crops:commands.exportAll'),
      group: 'navigation',
      keywords: keywordList(t, 'crops:commands.keywords.exportAll'),
      shortcutHint: 'Alt+Shift+J',
      keys: { alt: true, shift: true, key: 'j' },
      contextTags: ['crops'],
      isEnabled: () => true,
      action: handleExportAllCrops,
    },
    {
      id: 'crop.import',
      label: t('crops:commands.import'),
      group: 'navigation',
      keywords: keywordList(t, 'crops:commands.keywords.import'),
      shortcutHint: 'Alt+I',
      keys: { alt: true, key: 'i' },
      contextTags: ['crops'],
      isEnabled: () => true,
      action: handleImportFileTrigger,
    },
    {
      id: 'crop.createPlan',
      label: t('crops:commands.createPlan'),
      group: 'navigation',
      keywords: keywordList(t, 'crops:commands.keywords.createPlan'),
      shortcutHint: 'Alt+P',
      keys: { alt: true, key: 'p' },
      contextTags: ['crops'],
      isEnabled: () => Boolean(selectedCropId),
      action: handleCreatePlantingPlan,
    },
    {
      id: 'crop.previous',
      label: t('crops:commands.previous'),
      group: 'navigation',
      keywords: keywordList(t, 'crops:commands.keywords.previous'),
      shortcutHint: 'Alt+Shift+←',
      keys: { alt: true, shift: true, key: 'ArrowLeft' },
      contextTags: ['crops'],
      isEnabled: () => crops.length > 1 && Boolean(selectedCropId),
      action: () => goToRelativeCrop('previous'),
    },
    {
      id: 'crop.next',
      label: t('crops:commands.next'),
      group: 'navigation',
      keywords: keywordList(t, 'crops:commands.keywords.next'),
      shortcutHint: 'Alt+Shift+→',
      keys: { alt: true, shift: true, key: 'ArrowRight' },
      contextTags: ['crops'],
      isEnabled: () => crops.length > 1 && Boolean(selectedCropId),
      action: () => goToRelativeCrop('next'),
    },
  ];
}
