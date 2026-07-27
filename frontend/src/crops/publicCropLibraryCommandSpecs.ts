import type { PublicCulture } from '../api/types';
import type { CommandSpec } from '../commands/types';

export type CreatePublicCropLibraryCommandSpecsOptions = {
  cultures: PublicCulture[];
  focusSearch: () => void;
  goToRelativeCulture: (direction: 'next' | 'previous') => void;
  handleImport: () => void;
  openEditDialog: () => void;
  selectedCulture?: PublicCulture | null;
  importing: boolean;
};

export function createPublicCropLibraryCommandSpecs({
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
      label: 'Kulturbibliothek durchsuchen fokussieren (/)',
      group: 'navigation',
      keywords: ['kultur', 'suchen', 'search', 'filter', 'bibliothek'],
      shortcutHint: '/',
      keys: { key: '/' },
      contextTags: ['publicCropLibrary'],
      isEnabled: () => true,
      action: focusSearch,
    },
    {
      id: 'publicCropLibrary.edit',
      label: 'Öffentliche Kultur bearbeiten (Alt+E)',
      group: 'navigation',
      keywords: ['kultur', 'bearbeiten', 'edit', 'bibliothek'],
      shortcutHint: 'Alt+E',
      keys: { alt: true, key: 'e' },
      contextTags: ['publicCropLibrary'],
      isEnabled: () => Boolean(selectedCulture),
      action: openEditDialog,
    },
    {
      id: 'publicCropLibrary.import',
      label: 'Kultur ins Projekt übernehmen (Alt+I)',
      group: 'navigation',
      keywords: ['import', 'übernehmen', 'projekt', 'kultur'],
      shortcutHint: 'Alt+I',
      keys: { alt: true, key: 'i' },
      contextTags: ['publicCropLibrary'],
      isEnabled: () => Boolean(selectedCulture) && !importing,
      action: handleImport,
    },
    {
      id: 'publicCropLibrary.previous',
      label: 'Vorherige Kultur (Alt+Shift+←)',
      group: 'navigation',
      keywords: ['vorherige', 'kultur', 'left'],
      shortcutHint: 'Alt+Shift+←',
      keys: { alt: true, shift: true, key: 'ArrowLeft' },
      contextTags: ['publicCropLibrary'],
      isEnabled: () => cultures.length > 1 && Boolean(selectedCulture),
      action: () => goToRelativeCulture('previous'),
    },
    {
      id: 'publicCropLibrary.next',
      label: 'Nächste Kultur (Alt+Shift+→)',
      group: 'navigation',
      keywords: ['nächste', 'kultur', 'right'],
      shortcutHint: 'Alt+Shift+→',
      keys: { alt: true, shift: true, key: 'ArrowRight' },
      contextTags: ['publicCropLibrary'],
      isEnabled: () => cultures.length > 1 && Boolean(selectedCulture),
      action: () => goToRelativeCulture('next'),
    },
  ];
}
