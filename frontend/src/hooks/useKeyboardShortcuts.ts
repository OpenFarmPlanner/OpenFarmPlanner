import { useEffect } from 'react';

export interface ShortcutKeys {
  alt?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  key: string;
}

/** One shortcut can be reachable via more than one key combination (e.g. a
 * command palette bound to both the app's legacy Alt+K and the Ctrl+K
 * convention most professional apps use). */
export type ShortcutKeyBinding = ShortcutKeys | ShortcutKeys[];

export interface ShortcutSpec {
  id: string;
  title: string;
  keys: ShortcutKeyBinding;
  contexts: string[];
  allowRepeat?: boolean;
  when?: () => boolean;
  action: () => void;
}

const normalizeKey = (key: string): string => {
  if (key.length === 1) {
    return key.toLowerCase();
  }

  return key;
};

/** A single, non-alphanumeric character (e.g. `?`, `!`) usually requires
 * Shift to type on common layouts, but not on all of them — so unless a
 * binding explicitly cares about Shift, punctuation keys match regardless of
 * the Shift key's actual state. Letters/digits still require an exact Shift
 * match, since Shift there changes the produced key entirely. */
const isShiftInsensitiveKey = (keys: ShortcutKeys): boolean => (
  keys.shift === undefined && keys.key.length === 1 && !/[a-z0-9]/i.test(keys.key)
);

const hasModifierMismatch = (event: KeyboardEvent, keys: ShortcutKeys): boolean => {
  const expectedAlt = Boolean(keys.alt);
  const expectedCtrl = Boolean(keys.ctrl);
  const expectedShift = Boolean(keys.shift);
  const shiftMismatch = !isShiftInsensitiveKey(keys) && event.shiftKey !== expectedShift;

  return (
    event.altKey !== expectedAlt ||
    event.ctrlKey !== expectedCtrl ||
    shiftMismatch ||
    event.metaKey
  );
};

export const isTypingInEditableElement = (element: Element | null): boolean => {
  if (!element) {
    return false;
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return true;
  }

  if (element instanceof HTMLElement && element.isContentEditable) {
    return true;
  }

  const blockedAncestor = element.closest([
    'input',
    'textarea',
    'select',
    '[contenteditable="true"]',
    '[role="textbox"]',
    '[role="dialog"]',
    '[role="menu"]',
    '[role="combobox"]',
    '.MuiPopover-root',
    '.MuiMenu-root',
    '.MuiDialog-root',
    '.MuiDataGrid-cell--editing',
    '.MuiDataGrid-row--editing',
  ].join(', '));
  return Boolean(blockedAncestor);
};

export const matchesShortcut = (event: KeyboardEvent, keys: ShortcutKeys): boolean => {
  if (hasModifierMismatch(event, keys)) {
    return false;
  }

  return normalizeKey(event.key) === normalizeKey(keys.key);
};

export const matchesShortcutBinding = (event: KeyboardEvent, binding: ShortcutKeyBinding): boolean => {
  const bindings = Array.isArray(binding) ? binding : [binding];
  return bindings.some((keys) => matchesShortcut(event, keys));
};

/** Renders a binding as a human-readable hint, e.g. "Ctrl+K" or "Ctrl+K / Alt+K". */
export const describeShortcutBinding = (binding: ShortcutKeyBinding): string => {
  const bindings = Array.isArray(binding) ? binding : [binding];
  return bindings
    .map((keys) => {
      const parts: string[] = [];
      if (keys.ctrl) parts.push('Ctrl');
      if (keys.alt) parts.push('Alt');
      if (keys.shift) parts.push('Shift');
      parts.push(keys.key.length === 1 ? keys.key.toUpperCase() : keys.key);
      return parts.join('+');
    })
    .join(' / ');
};

interface UseKeyboardShortcutsOptions {
  currentContexts: string[];
  allowWhenTyping?: boolean;
}

export function useKeyboardShortcuts(
  shortcuts: ShortcutSpec[],
  enabled: boolean,
  options: UseKeyboardShortcutsOptions,
): void {
  const { currentContexts, allowWhenTyping = false } = options;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!allowWhenTyping && isTypingInEditableElement(document.activeElement)) {
        return;
      }

      const matchedShortcut = shortcuts.find((shortcut) => {
        if (event.repeat && !shortcut.allowRepeat) {
          return false;
        }

        const inContext = shortcut.contexts.every((context) => currentContexts.includes(context));
        if (!inContext) {
          return false;
        }

        if (shortcut.when && !shortcut.when()) {
          return false;
        }

        return matchesShortcutBinding(event, shortcut.keys);
      });

      if (!matchedShortcut) {
        return;
      }

      event.preventDefault();
      matchedShortcut.action();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [allowWhenTyping, currentContexts, enabled, shortcuts]);
}
