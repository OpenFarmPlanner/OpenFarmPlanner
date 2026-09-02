import type { Ref } from 'react';
import { InputAdornment, TextField } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

interface GanttSearchFieldProps {
  placeholder: string;
  value: string;
  onValueChange: (value: string) => void;
  inputRef: Ref<HTMLInputElement>;
  /** Layout-specific sizing; the calendars use different widths per breakpoint. */
  sx?: SxProps<Theme>;
}

/**
 * Search input shared by the calendar filter bars (bed occupancy and
 * seedlings, in both their mobile and desktop layouts). Only the placeholder
 * and the layout `sx` differ between call sites.
 */
export function GanttSearchField({
  placeholder,
  value,
  onValueChange,
  inputRef,
  sx,
}: GanttSearchFieldProps) {
  return (
    <TextField
      size="small"
      placeholder={placeholder}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      inputRef={inputRef}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
        },
      }}
      sx={sx}
    />
  );
}
