/**
 * Searchable select input based on MUI Autocomplete.
 *
 * @remarks
 * Use for form-level searchable dropdowns with a shared option shape.
 *
 * @param props - Component props.
 * @param props.options - Options to display.
 * @param props.value - Currently selected option.
 * @param props.onChange - Callback when selection changes.
 * @param props.label - TextField label.
 * @param props.placeholder - TextField placeholder.
 * @param props.noOptionsText - Text to show when no options match.
 * @param props.size - Input size.
 * @param props.fullWidth - Whether to stretch to container width.
 * @param props.autoFocus - Whether to focus the input on mount.
 * @param props.textFieldSx - Optional sx overrides for the TextField.
 * @param props.inputRef - Ref to the underlying input element, for imperative focus.
 * @returns Searchable select input.
 */

import { useState } from 'react';
import { Autocomplete, TextField } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ReactNode, Ref } from 'react';

export interface SearchableSelectOption<T = unknown> {
  value: number;
  label: string;
  data?: T;
}

export interface SearchableSelectProps<T = unknown> {
  options: SearchableSelectOption<T>[];
  value: SearchableSelectOption<T> | null;
  onChange: (value: SearchableSelectOption<T> | null) => void;
  label?: string;
  placeholder?: string;
  noOptionsText?: string;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  autoFocus?: boolean;
  inputTabIndex?: number;
  textFieldSx?: SxProps<Theme>;
  inputValue?: string;
  onInputChange?: (value: string) => void;
  endAdornment?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
  open?: boolean;
  onOpen?: () => void;
  onClose?: (event: unknown) => void;
}

// Combines Autocomplete's own internal input ref (needed for its keyboard/focus
// handling) with a caller-supplied ref, without calling a hook inside renderInput
// (renderInput runs during Autocomplete's own render, not this component's).
function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): (node: T | null) => void {
  return (node) => {
    refs.forEach((ref) => {
      if (!ref) {
        return;
      }
      if (typeof ref === 'function') {
        ref(node);
      } else {
        (ref as React.MutableRefObject<T | null>).current = node;
      }
    });
  };
}

export function SearchableSelect<T = unknown>({
  options,
  value,
  onChange,
  label,
  placeholder,
  noOptionsText,
  size = 'medium',
  fullWidth = true,
  autoFocus = false,
  inputTabIndex,
  textFieldSx,
  inputValue,
  onInputChange,
  endAdornment,
  inputRef,
  open,
  onOpen,
  onClose,
}: SearchableSelectProps<T>) {
  const [internalInputValue, setInternalInputValue] = useState('');
  const resolvedInputValue = inputValue ?? internalInputValue;

  const handleInputChange = (_: unknown, newInputValue: string, reason: string) => {
    if (inputValue === undefined) {
      setInternalInputValue(newInputValue);
    }
    if (reason === 'input' || reason === 'clear') {
      onInputChange?.(newInputValue);
    }
  };

  return (
    <Autocomplete
      fullWidth={fullWidth}
      autoHighlight
      openOnFocus
      open={open}
      onOpen={onOpen}
      onClose={onClose}
      size={size}
      options={options}
      value={value}
      inputValue={resolvedInputValue}
      onInputChange={handleInputChange}
      onChange={(_, newValue) => onChange(newValue)}
      isOptionEqualToValue={(option, selected) => option.value === selected.value}
      getOptionLabel={(option) => option.label}
      renderOption={(props, option) => (
        <li {...props} key={option.value}>
          {option.label}
        </li>
      )}
      noOptionsText={noOptionsText}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          autoFocus={autoFocus}
          sx={textFieldSx}
          slotProps={{
            ...params.slotProps,

            htmlInput: {
              ...params.slotProps.htmlInput,
              ref: mergeRefs(params.slotProps.htmlInput.ref, inputRef),
              tabIndex: inputTabIndex,
            },

            input: {
              ...params.slotProps.input,
              endAdornment: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  {params.slotProps.input.endAdornment}
                  {endAdornment}
                </span>
              ),
            }
          }} />
      )}
    />
  );
}
