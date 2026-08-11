import { Children, isValidElement, useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

export interface SelectTypeaheadOption<Value = unknown> {
  value: Value;
  label: string;
  disabled?: boolean;
  hidden?: boolean;
  child?: ReactNode;
}

interface UseClosedSelectTypeaheadProps<Value> {
  options: SelectTypeaheadOption<Value>[];
  value: Value | Value[] | null | undefined;
  multiple?: boolean;
  timeoutMs?: number;
  onSelect: (value: Value | Value[], event: KeyboardEvent<Element>, option: SelectTypeaheadOption<Value>) => void;
  onKeyDown?: (event: KeyboardEvent<Element>) => void;
}

interface SelectOptionElementProps<Value = unknown> {
  value?: Value;
  disabled?: boolean;
  hidden?: boolean;
  style?: {
    display?: string;
    visibility?: string;
  };
  children?: ReactNode;
  primary?: ReactNode;
}

const DEFAULT_TYPEAHEAD_TIMEOUT_MS = 700;

const isEditableTypeaheadTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(target.closest([
    'input:not([type="hidden"])',
    'textarea',
    '[contenteditable="true"]',
    '[role="textbox"]',
    '.MuiAutocomplete-root',
  ].join(', ')));
};

const isClosedSelectTypeaheadKey = (event: KeyboardEvent<Element>): boolean => (
  event.key.length === 1
  && !event.altKey
  && !event.ctrlKey
  && !event.metaKey
  && !isEditableTypeaheadTarget(event.target)
);

const isSelectOpen = (event: KeyboardEvent<Element>): boolean => {
  const target = event.target instanceof Element ? event.target : null;
  const currentTarget = event.currentTarget instanceof Element ? event.currentTarget : null;
  const combobox = target?.closest('[role="combobox"]')
    ?? currentTarget?.querySelector('[role="combobox"]')
    ?? currentTarget?.closest('[role="combobox"]');

  return combobox?.getAttribute('aria-expanded') === 'true';
};

const normalizeLabel = (label: string): string => label.trim().toLocaleLowerCase();

const areOptionValuesEqual = (left: unknown, right: unknown): boolean => (
  left === right || String(left) === String(right)
);

const isSameSelection = <Value,>(
  currentValue: Value | Value[] | null | undefined,
  nextValue: Value | Value[],
  multiple: boolean,
): boolean => {
  if (!multiple) {
    return areOptionValuesEqual(currentValue, nextValue);
  }

  if (!Array.isArray(currentValue) || !Array.isArray(nextValue)) {
    return false;
  }

  return (
    currentValue.length === nextValue.length
    && currentValue.every((value, index) => areOptionValuesEqual(value, nextValue[index]))
  );
};

const resolveNextValue = <Value,>(
  currentValue: Value | Value[] | null | undefined,
  optionValue: Value,
  multiple: boolean,
): Value | Value[] => {
  if (!multiple) {
    return optionValue;
  }

  const currentValues = Array.isArray(currentValue) ? currentValue : [];
  if (currentValues.some((value) => areOptionValuesEqual(value, optionValue))) {
    return currentValues;
  }
  return [...currentValues, optionValue];
};

const getNodeText = (node: ReactNode): string => {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getNodeText).join(' ');
  }

  if (!isValidElement<SelectOptionElementProps>(node)) {
    return '';
  }

  if (node.props.primary !== undefined) {
    return getNodeText(node.props.primary);
  }

  return getNodeText(node.props.children);
};

export const collectSelectTypeaheadOptions = <Value = unknown,>(
  children: ReactNode,
): SelectTypeaheadOption<Value>[] => {
  const options: SelectTypeaheadOption<Value>[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement<SelectOptionElementProps<Value>>(child)) {
      return;
    }

    if (child.props.value !== undefined) {
      options.push({
        value: child.props.value,
        label: getNodeText(child.props.children),
        disabled: child.props.disabled,
        hidden: child.props.hidden
          || child.props.style?.display === 'none'
          || child.props.style?.visibility === 'hidden',
        child,
      });
      return;
    }

    options.push(...collectSelectTypeaheadOptions<Value>(child.props.children));
  });

  return options;
};

export function useClosedSelectTypeahead<Value = unknown>({
  options,
  value,
  multiple = false,
  timeoutMs = DEFAULT_TYPEAHEAD_TIMEOUT_MS,
  onSelect,
  onKeyDown,
}: UseClosedSelectTypeaheadProps<Value>): (event: KeyboardEvent<Element>) => void {
  const bufferRef = useRef('');
  const resetTimerRef = useRef<number | null>(null);

  const clearBuffer = useCallback((): void => {
    bufferRef.current = '';
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const scheduleBufferReset = useCallback((): void => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(clearBuffer, timeoutMs);
  }, [clearBuffer, timeoutMs]);

  useEffect(() => clearBuffer, [clearBuffer]);

  return useCallback((event: KeyboardEvent<Element>): void => {
    onKeyDown?.(event);
    if (event.defaultPrevented) {
      return;
    }

    if (!isClosedSelectTypeaheadKey(event) || isSelectOpen(event)) {
      if (event.key !== 'Shift') {
        clearBuffer();
      }
      return;
    }

    // MUI v9's Select added its own built-in closed-select typeahead
    // (SelectInput's `handleClosedTypeahead`), which keeps a separate
    // buffer with its own 750ms reset timer. Claim every eligible
    // keystroke unconditionally — not just matched ones — so that
    // competing implementation never sees it (it bails out whenever
    // `event.defaultPrevented` is already true) and this hook stays the
    // single source of truth for the search buffer.
    event.preventDefault();
    event.stopPropagation();

    bufferRef.current = `${bufferRef.current}${event.key}`;
    scheduleBufferReset();

    const searchTerm = normalizeLabel(bufferRef.current);
    const match = options.find((option) => (
      !option.disabled
      && !option.hidden
      && normalizeLabel(option.label).startsWith(searchTerm)
    ));

    if (!match) {
      return;
    }

    const nextValue = resolveNextValue(value, match.value, multiple);

    if (!isSameSelection(value, nextValue, multiple)) {
      onSelect(nextValue, event, match);
    }
  }, [clearBuffer, multiple, onKeyDown, onSelect, options, scheduleBufferReset, value]);
}
