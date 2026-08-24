import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { getTabbableNeighbour } from '../../focus/focusableElements';
import type { SelectTypeaheadOption } from './selectTypeahead';

/** Surfaces that own their focus order: Tab cycles inside them, so handing
 * focus from the last field back to the first one is the expected behaviour.
 * A plain page form is not such a surface — Tab has to be able to leave it. */
const MODAL_FOCUS_SCOPE_SELECTOR = '[role="dialog"], [role="alertdialog"], .MuiPopover-paper';
const MENU_FOCUS_RESTORE_DELAY_MS = 250;

interface FocusScope {
  container: HTMLElement;
  wrap: boolean;
}

const resolveFocusScope = (trigger: HTMLElement): FocusScope | null => {
  const modalScope = trigger.closest<HTMLElement>(MODAL_FOCUS_SCOPE_SELECTOR);
  if (modalScope) {
    return { container: modalScope, wrap: true };
  }

  const form = trigger.closest('form');
  return form ? { container: form, wrap: false } : null;
};

/** The Select trigger that opened `listboxId`. MUI links the two through
 * `aria-controls`, which is the only connection available from the menu: the
 * menu renders in its own portal, far away from the trigger. */
const findTriggerForListbox = (listboxId: string): HTMLElement | null => (
  Array.from(document.querySelectorAll<HTMLElement>('[role="combobox"][aria-expanded="true"]'))
    .find((element) => element.getAttribute('aria-controls') === listboxId) ?? null
);

const getHighlightedOptionValue = (listbox: HTMLElement): string | null => {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement) || !listbox.contains(activeElement)) {
    return null;
  }

  return activeElement.closest<HTMLElement>('[role="option"]')?.getAttribute('data-value') ?? null;
};

/** MUI renders a Select's option list as the `<ul>` of its floating menu. */
export type SelectMenuKeyboardEvent = KeyboardEvent<HTMLUListElement>;

interface UseOpenSelectTabNavigationProps<Value> {
  options: SelectTypeaheadOption<Value>[];
  multiple?: boolean;
  onSelect: (value: Value, event: KeyboardEvent<Element>, option: SelectTypeaheadOption<Value>) => void;
  onKeyDown?: (event: SelectMenuKeyboardEvent) => void;
}

interface PendingFocusAdvance {
  trigger: HTMLElement;
  direction: 1 | -1;
}

/**
 * Tab / Shift+Tab while a Select's dropdown is open.
 *
 * MUI's `Menu` already closes the dropdown on Tab and swallows the browser's
 * default focus move, which is what keeps focus inside a surrounding dialog or
 * popover. What it does not do is take over the highlighted option or continue
 * to the neighbouring field, so Tab reads as "nothing happened". This hook adds
 * both, and runs the focus move from an effect on purpose: MUI restores focus
 * to the Select trigger while committing the close, so a focus call made any
 * earlier would be overwritten again.
 *
 * Multi-selects are left alone — their menu stays open across selections, and
 * silently toggling the highlighted option on the way out would be surprising.
 */
export function useOpenSelectTabNavigation<Value = unknown>({
  options,
  multiple = false,
  onSelect,
  onKeyDown,
}: UseOpenSelectTabNavigationProps<Value>): (event: SelectMenuKeyboardEvent) => void {
  const pendingAdvanceRef = useRef<PendingFocusAdvance | null>(null);
  const [advanceRequestCount, setAdvanceRequestCount] = useState(0);

  useEffect(() => {
    const pendingAdvance = pendingAdvanceRef.current;
    if (!pendingAdvance) {
      return;
    }

    pendingAdvanceRef.current = null;
    // Menu's close transition restores focus to the Select trigger after this
    // effect phase. Advancing after that restoration makes our requested Tab
    // target the final focus destination instead of letting the trigger win.
    const timerId = window.setTimeout(() => {
      const scope = resolveFocusScope(pendingAdvance.trigger);
      if (!scope) {
        return;
      }

      getTabbableNeighbour(
        scope.container,
        pendingAdvance.trigger,
        pendingAdvance.direction,
        { wrap: scope.wrap },
      )?.focus();
    }, MENU_FOCUS_RESTORE_DELAY_MS);

    return () => window.clearTimeout(timerId);
  }, [advanceRequestCount]);

  return useCallback((event: SelectMenuKeyboardEvent): void => {
    onKeyDown?.(event);
    if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const listbox = event.currentTarget;
    const trigger = findTriggerForListbox(listbox.id);
    const highlightedValue = multiple ? null : getHighlightedOptionValue(listbox);
    const highlightedOption = highlightedValue === null
      ? undefined
      : options.find((option) => (
        !option.disabled
        && !option.hidden
        && String(option.value) === highlightedValue
      ));

    if (highlightedOption) {
      onSelect(highlightedOption.value, event, highlightedOption);
    }
    if (trigger) {
      pendingAdvanceRef.current = { trigger, direction: event.shiftKey ? -1 : 1 };
      setAdvanceRequestCount((count) => count + 1);
    }
  }, [multiple, onKeyDown, onSelect, options]);
}
