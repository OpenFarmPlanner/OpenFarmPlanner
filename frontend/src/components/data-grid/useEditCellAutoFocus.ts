import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Focuses (and optionally does something further with, e.g. select()) an
 * edit cell's input once MUI DataGrid reports this cell has focus (the
 * `hasFocus` prop every `renderEditCell` component receives).
 *
 * Always calls `.focus({ preventScroll: true })`. A plain, unguarded
 * `.focus()` here fights the mobile on-screen keyboard's own
 * viewport-driven scroll adjustment: tapping a cell to edit it first
 * scrolls the cell into view against the *pre-keyboard* viewport (this
 * call), then the keyboard opens and the browser re-scrolls the now-focused
 * input against the *shrunk* viewport — two different scroll targets a
 * moment apart read as a visible jump-then-correct. Every other
 * programmatic focus in this grid (`keyboardNavigation.ts`'s `focusEditor`,
 * `keyboardEditing.ts`, `contextMenuFocus.ts`) already uses
 * `preventScroll: true` for the same reason; this hook is the one
 * `hasFocus`-driven path shared by the custom numeric edit cells that
 * didn't, before this fix.
 */
export function useEditCellAutoFocus(
  hasFocus: boolean,
  inputRef: RefObject<HTMLInputElement | null>,
  onFocused?: (input: HTMLInputElement) => void,
): void {
  useEffect(() => {
    if (!hasFocus) {
      return;
    }
    const input = inputRef.current;
    if (!input) {
      return;
    }
    input.focus({ preventScroll: true });
    onFocused?.(input);
  }, [hasFocus, inputRef, onFocused]);
}
