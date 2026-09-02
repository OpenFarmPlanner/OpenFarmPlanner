import { useCallback, useEffect, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { GridRowId } from '@mui/x-data-grid';

/**
 * Shared "Enter commits the focused option" behavior for the single-select edit
 * cells (`StandardSingleSelectEditCell`, `CultivationTypeEditCell`). MUI's
 * `Select` menu does not commit the option under the keyboard cursor on Enter by
 * itself while the grid is in edit mode, so both cells covered it twice:
 *
 * - a React `onKeyDown` on the menu list (`handleMenuKeyDown`), and
 * - a capture-phase document listener installed while the menu is open, to catch
 *   the Enter before MUI's own handler closes the menu without committing.
 *
 * This hook returns the menu-list handler and installs the document listener,
 * both resolving the focused `[role="option"]` and committing its value.
 */

interface SelectMenuOption {
  value: string | number;
}

interface EditCellValueSetter {
  setEditCellValue: (params: { id: GridRowId; field: string; value: string | number }) => unknown;
}

interface UseSelectMenuEnterCommitConfig<T extends SelectMenuOption> {
  open: boolean;
  options: readonly T[];
  api: EditCellValueSetter;
  id: GridRowId;
  field: string;
  setOpen: (open: boolean) => void;
  notifyMenuClose: (event: unknown) => void;
}

const MENU_OPTION_SELECTOR =
  '[role="option"].Mui-focusVisible, [role="option"].Mui-selected, [role="option"][aria-selected="true"]';
const DOCUMENT_OPTION_SELECTOR =
  '[role="listbox"] [role="option"].Mui-focusVisible, [role="listbox"] [role="option"].Mui-selected, [role="listbox"] [role="option"][aria-selected="true"]';

function isPlainEnter(event: {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}): boolean {
  return event.key === 'Enter' && !event.altKey && !event.ctrlKey && !event.metaKey;
}

function findOptionForElement<T extends SelectMenuOption>(
  selectedElement: HTMLElement | null,
  options: readonly T[],
): T | undefined {
  const nextValue = selectedElement?.getAttribute('data-value');
  return nextValue ? options.find((option) => String(option.value) === nextValue) : undefined;
}

export function useSelectMenuEnterCommit<T extends SelectMenuOption>({
  open,
  options,
  api,
  id,
  field,
  setOpen,
  notifyMenuClose,
}: UseSelectMenuEnterCommitConfig<T>): (event: ReactKeyboardEvent<HTMLUListElement>) => void {
  const commit = useCallback((option: T, event: unknown): void => {
    void api.setEditCellValue({ id, field, value: option.value });
    setOpen(false);
    notifyMenuClose(event);
  }, [api, field, id, notifyMenuClose, setOpen]);

  const handleMenuKeyDown = useCallback((event: ReactKeyboardEvent<HTMLUListElement>): void => {
    if (!isPlainEnter(event)) {
      return;
    }

    const selectedElement = event.currentTarget.querySelector<HTMLElement>(MENU_OPTION_SELECTOR);
    const nextOption = findOptionForElement(selectedElement, options);
    if (!nextOption) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation?.();
    commit(nextOption, event);
  }, [commit, options]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleDocumentKeyDownCapture = (event: globalThis.KeyboardEvent): void => {
      if (!isPlainEnter(event)) {
        return;
      }

      const activeElement = document.activeElement;
      const selectedElement = (
        activeElement instanceof HTMLElement
          ? activeElement.closest<HTMLElement>('[role="option"]')
          : null
      ) ?? document.querySelector<HTMLElement>(DOCUMENT_OPTION_SELECTOR);
      const nextOption = findOptionForElement(selectedElement, options);
      if (!nextOption) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      commit(nextOption, event);
    };

    document.addEventListener('keydown', handleDocumentKeyDownCapture, true);
    return () => document.removeEventListener('keydown', handleDocumentKeyDownCapture, true);
  }, [commit, open, options]);

  return handleMenuKeyDown;
}
