import { forwardRef, useCallback, useMemo } from 'react';
import type { KeyboardEvent, ReactElement, ReactNode, Ref } from 'react';
import MuiSelect from '@mui/material/Select';
import type { SelectChangeEvent, SelectProps } from '@mui/material/Select';
import {
  collectSelectTypeaheadOptions,
  useClosedSelectTypeahead,
} from './selectTypeahead';
import type { SelectTypeaheadOption } from './selectTypeahead';
import { useOpenSelectTabNavigation } from './selectDropdownTabNavigation';
import type { SelectMenuKeyboardEvent } from './selectDropdownTabNavigation';

export type TypeaheadSelectProps<Value = unknown> = Omit<SelectProps<Value>, 'onKeyDown'> & {
  onKeyDown?: (event: KeyboardEvent<Element>) => void;
  typeaheadTimeoutMs?: number;
};

type SelectMenuProps<Value> = NonNullable<SelectProps<Value>['MenuProps']>;
type MenuListSlotProps = {
  onKeyDown?: (event: SelectMenuKeyboardEvent) => void;
} & Record<string, unknown>;

const createSelectChangeEvent = <Value,>(
  sourceEvent: KeyboardEvent<Element>,
  value: Value | Value[],
  name: string | undefined,
): SelectChangeEvent<Value> => {
  const target = { value, name };
  return {
    ...sourceEvent,
    target,
    currentTarget: target,
  } as unknown as SelectChangeEvent<Value>;
};

/** `slotProps.list` may be a callback that receives MUI's owner state; only the
 * object form can be merged with the menu keyboard handling added here. */
const readMenuListSlotProps = <Value,>(menuProps: SelectMenuProps<Value> | undefined): MenuListSlotProps => {
  const listSlotProps = menuProps?.slotProps?.list;
  return typeof listSlotProps === 'function' ? {} : (listSlotProps as MenuListSlotProps | undefined) ?? {};
};

function TypeaheadSelectInner<Value = unknown>(
  {
    children,
    multiple,
    onChange,
    onKeyDown,
    typeaheadTimeoutMs,
    value,
    name,
    MenuProps,
    ...props
  }: TypeaheadSelectProps<Value>,
  ref: Ref<HTMLDivElement>,
): ReactElement {
  const options = useMemo(
    () => collectSelectTypeaheadOptions<Value>(children),
    [children],
  );

  const handleSelect = useCallback((
    nextValue: Value | Value[],
    event: KeyboardEvent<Element>,
    option: SelectTypeaheadOption<Value>,
  ): void => {
    onChange?.(createSelectChangeEvent(event, nextValue, name), option.child as ReactNode);
  }, [name, onChange]);

  const handleKeyDown = useClosedSelectTypeahead<Value>({
    options,
    value: value as Value | Value[] | null | undefined,
    multiple,
    timeoutMs: typeaheadTimeoutMs,
    onSelect: handleSelect,
    onKeyDown,
  });

  const listSlotProps = useMemo(() => readMenuListSlotProps<Value>(MenuProps), [MenuProps]);
  const handleMenuKeyDown = useOpenSelectTabNavigation<Value>({
    options,
    multiple,
    onSelect: handleSelect,
    onKeyDown: listSlotProps.onKeyDown,
  });

  const menuProps = useMemo((): SelectMenuProps<Value> => ({
    ...MenuProps,
    slotProps: {
      ...MenuProps?.slotProps,
      list: { ...listSlotProps, onKeyDown: handleMenuKeyDown },
    },
  }), [MenuProps, handleMenuKeyDown, listSlotProps]);

  return (
    // MUI v9's Select gained its own built-in closed-select typeahead with a
    // 750ms reset timer, which otherwise races the app's own (differently
    // timed, i18n- and hidden-option-aware) search in `handleKeyDown` below.
    // Wiring `handleKeyDown` through `onKeyDownCapture` on this wrapper lets
    // it run — and call `preventDefault()` — *before* MUI's own bubble-phase
    // handler, so MUI's competing implementation always bails out instead of
    // racing this one. `display: contents` keeps the wrapper out of the box
    // model entirely, so it doesn't affect layout inside a FormControl.
    <div style={{ display: 'contents' }} onKeyDownCapture={handleKeyDown}>
      <MuiSelect<Value>
        {...props}
        ref={ref}
        name={name}
        multiple={multiple}
        value={value}
        onChange={onChange}
        MenuProps={menuProps}
      >
        {children}
      </MuiSelect>
    </div>
  );
}

export const TypeaheadSelect = forwardRef(TypeaheadSelectInner) as <Value = unknown>(
  props: TypeaheadSelectProps<Value> & { ref?: Ref<HTMLDivElement> },
) => ReactElement;
