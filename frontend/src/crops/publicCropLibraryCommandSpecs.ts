import type { TFunction } from 'i18next';

import type { PublicCulture } from '../api/types';
import type { CommandSpec } from '../commands/types';
import { keywordList } from '../commands/keywordList';

export type CreatePublicCropLibraryCommandSpecsOptions = {
  /** Command palette labels and search keywords follow the UI language. */
  t: TFunction;
  cultures: PublicCulture[];
  focusSearch: () => void;
  goToRelativeCulture: (direction: 'next' | 'previous') => void;
  handleImport: () => void;
  openEditDialog: () => void;
  selectedCulture?: PublicCulture | null;
  importing: boolean;
};

export function createPublicCropLibraryCommandSpecs({
  t,
  cultures,
  focusSearch,
  goToRelativeCulture,
  handleImport,
  openEditDialog,
  selectedCulture,
  importing,
}: CreatePublicCropLibraryCommandSpecsOptions): CommandSpec[] {
  return [
    {
      id: 'publicCropLibrary.focusSearch',
      label: t('cultures:library.commands.focusSearch'),
      group: 'navigation',
      keywords: keywordList(t, 'cultures:library.commands.keywords.search'),
      shortcutHint: '/',
      keys: { key: '/' },
      contextTags: ['publicCropLibrary'],
      isEnabled: () => true,
      action: focusSearch,
    },
    {
      id: 'publicCropLibrary.edit',
      label: t('cultures:library.commands.edit'),
      group: 'navigation',
      keywords: keywordList(t, 'cultures:library.commands.keywords.edit'),
      shortcutHint: 'Alt+E',
      keys: { alt: true, key: 'e' },
      contextTags: ['publicCropLibrary'],
      isEnabled: () => Boolean(selectedCulture),
      action: openEditDialog,
    },
    {
      id: 'publicCropLibrary.import',
      label: t('cultures:library.commands.import'),
      group: 'navigation',
      keywords: keywordList(t, 'cultures:library.commands.keywords.import'),
      shortcutHint: 'Alt+I',
      keys: { alt: true, key: 'i' },
      contextTags: ['publicCropLibrary'],
      isEnabled: () => Boolean(selectedCulture) && !importing,
      action: handleImport,
    },
    {
      id: 'publicCropLibrary.previous',
      label: t('cultures:library.commands.previous'),
      group: 'navigation',
      keywords: keywordList(t, 'cultures:library.commands.keywords.previous'),
      shortcutHint: 'Alt+Shift+←',
      keys: { alt: true, shift: true, key: 'ArrowLeft' },
      contextTags: ['publicCropLibrary'],
      isEnabled: () => cultures.length > 1 && Boolean(selectedCulture),
      action: () => goToRelativeCulture('previous'),
    },
    {
      id: 'publicCropLibrary.next',
      label: t('cultures:library.commands.next'),
      group: 'navigation',
      keywords: keywordList(t, 'cultures:library.commands.keywords.next'),
      shortcutHint: 'Alt+Shift+→',
      keys: { alt: true, shift: true, key: 'ArrowRight' },
      contextTags: ['publicCropLibrary'],
      isEnabled: () => cultures.length > 1 && Boolean(selectedCulture),
      action: () => goToRelativeCulture('next'),
    },
  ];
}
