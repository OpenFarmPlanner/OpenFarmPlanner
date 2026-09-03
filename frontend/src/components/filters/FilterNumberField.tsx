import type { ReactElement } from 'react';
import { TextField } from '@mui/material';

interface FilterNumberFieldProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  /** `numeric` for whole counts (days), `decimal` for measured amounts (yield). */
  inputMode: 'numeric' | 'decimal';
}

/** One numeric min/max bound in a filter popover. */
export function FilterNumberField({
  label,
  value,
  onValueChange,
  inputMode,
}: FilterNumberFieldProps): ReactElement {
  return (
    <TextField
      size="small"
      type="number"
      label={label}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      slotProps={{ htmlInput: { inputMode } }}
    />
  );
}
