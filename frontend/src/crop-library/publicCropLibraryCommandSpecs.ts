import type { TFunction } from 'i18next';

import type { PublicCrop } from '../api/types';
import type { CommandSpec } from '../commands/types';
import { keywordList } from '../commands/keywordList';

export type CreatePublicCropLibraryCommandSpecsOptions = {
  /** Command palette labels and search keywords follow the UI language. */
  t: TFunction;
  crops: PublicCrop[];
  focusSearch: () => void;
  goToRelativeCrop: (direction: 'next' | 'previous') => void;
  handleImport: () => void;
  openEditDialog: () => void;
  selectedCrop?: PublicCrop | null;
  importing: boolean;
};

export function createPublicCropLibraryCommandSpecs({
  t,
  crops,
  focusSearch,
  goToRelativeCrop,
  handleImport,
  openEditDialog,
  selectedCrop,
  importing,
}: CreatePublicCropLibraryCommandSpecsOptions): CommandSpec[] {
  return [
    {
      id: 'publicCropLibrary.focusSearch',
      label: t('crops:library.commands.focusSearch'),
      group: 'navigation',
      keywords: keywordList(t, 'crops:library.commands.keywords.search'),
      shortcutHint: '/',
      keys: { key: '/' },
      contextTags: ['publicCropLibrary'],
      isEnabled: () => true,
      action: focusSearch,
    },
    {
      id: 'publicCropLibrary.edit',
      label: t('crops:library.commands.edit'),
      group: 'navigation',
      keywords: keywordList(t, 'crops:library.commands.keywords.edit'),
      shortcutHint: 'Alt+E',
      keys: { alt: true, key: 'e' },
      contextTags: ['publicCropLibrary'],
      isEnabled: () => Boolean(selectedCrop),
      action: openEditDialog,
    },
    {
      id: 'publicCropLibrary.import',
      label: t('crops:library.commands.import'),
      group: 'navigation',
      keywords: keywordList(t, 'crops:library.commands.keywords.import'),
      shortcutHint: 'Alt+I',
      keys: { alt: true, key: 'i' },
      contextTags: ['publicCropLibrary'],
      isEnabled: () => Boolean(selectedCrop) && !importing,
      action: handleImport,
    },
    {
      id: 'publicCropLibrary.previous',
      label: t('crops:library.commands.previous'),
      group: 'navigation',
      keywords: keywordList(t, 'crops:library.commands.keywords.previous'),
      shortcutHint: 'Alt+Shift+←',
      keys: { alt: true, shift: true, key: 'ArrowLeft' },
      contextTags: ['publicCropLibrary'],
      isEnabled: () => crops.length > 1 && Boolean(selectedCrop),
      action: () => goToRelativeCrop('previous'),
    },
    {
      id: 'publicCropLibrary.next',
      label: t('crops:library.commands.next'),
      group: 'navigation',
      keywords: keywordList(t, 'crops:library.commands.keywords.next'),
      shortcutHint: 'Alt+Shift+→',
      keys: { alt: true, shift: true, key: 'ArrowRight' },
      contextTags: ['publicCropLibrary'],
      isEnabled: () => crops.length > 1 && Boolean(selectedCrop),
      action: () => goToRelativeCrop('next'),
    },
  ];
}
