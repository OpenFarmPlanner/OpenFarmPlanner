import { useEffect } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import type { GridRowId } from '@mui/x-data-grid';
import type { EditCellTabNavigationHandler } from './EditCellNavigationContext';

/**
 * Shared Tab-forwarding behavior for the custom edit cells (numeric area,
 * plants count, date). Two entry points cover the two ways a Tab keystroke
 * reaches these inputs:
 *
 * - `useEditCellTabNavigation` installs a capture-phase native `keydown`
 *   listener so a Tab pressed inside a fully-rendered input is forwarded to the
 *   grid's edit-cell navigation before the browser moves focus.
 * - `forwardEditCellTabNavigation` is the React `onKeyDown` handler body for the
 *   same purpose.
 *
 * Both also stop `Ctrl/Cmd+A` from bubbling so select-all stays local to the
 * input instead of triggering a grid-level shortcut.
 */
export function useEditCellTabNavigation(
  inputRef: RefObject<HTMLInputElement | null>,
  editCellNavigation: EditCellTabNavigationHandler | null,
  id: GridRowId,
  field: string,
): void {
  useEffect(() => {
    const input = inputRef.current;
    if (!input || !editCellNavigation) {
      return undefined;
    }

    const handleNativeTabKeyDown = (event: globalThis.KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.stopPropagation();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      editCellNavigation({
        id,
        field,
        event: {
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          key: event.key,
          metaKey: event.metaKey,
          nativeEvent: event,
          preventDefault: () => event.preventDefault(),
          shiftKey: event.shiftKey,
          stopPropagation: () => event.stopPropagation(),
        },
      });
    };

    input.addEventListener('keydown', handleNativeTabKeyDown, { capture: true });
    return () => {
      input.removeEventListener('keydown', handleNativeTabKeyDown, { capture: true });
    };
  }, [editCellNavigation, field, id, inputRef]);
}

export function forwardEditCellTabNavigation<E extends HTMLElement>(
  event: ReactKeyboardEvent<E>,
  editCellNavigation: EditCellTabNavigationHandler | null,
  id: GridRowId,
  field: string,
): void {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
    event.stopPropagation();
    return;
  }

  if (event.key === 'Tab') {
    editCellNavigation?.({
      id,
      field,
      event: event as ReactKeyboardEvent<HTMLElement>,
    });
  }
}
