import { memo } from 'react';
import type { GridRenderEditCellParams } from '@mui/x-data-grid';
import { Box, MenuItem, TextField } from '@mui/material';
import type { SearchableSelectOption } from './SearchableSelectEditCell';
import { useSingleSelectEditCell } from './useSingleSelectEditCell';

interface StandardSingleSelectEditCellProps extends GridRenderEditCellParams {
  options: SearchableSelectOption[];
  placeholder?: string;
}

export const StandardSingleSelectEditCell = memo(function StandardSingleSelectEditCell({
  id,
  field,
  value,
  hasFocus,
  api,
  options,
  placeholder,
}: StandardSingleSelectEditCellProps) {
  const selectedOption = options.find((option) => option.value === value);
  const { open, handleOpen, handleClose, handleSelectKeyDown, handleMenuKeyDown } =
    useSingleSelectEditCell<number>({
      id,
      field,
      api,
      options,
      typeaheadValue: typeof value === 'number' ? value : Number(value),
    });

  return (
    <TextField
      select
      fullWidth
      size="small"
      autoFocus={hasFocus}
      value={value ?? ''}
      slotProps={{
        htmlInput: {
          tabIndex: hasFocus ? 0 : -1,
        },
        select: {
          displayEmpty: Boolean(placeholder),
          open,
          onClose: handleClose,
          onOpen: handleOpen,
          onKeyDown: handleSelectKeyDown,
          MenuProps: {
            slotProps: {
              list: {
                onKeyDown: handleMenuKeyDown,
              },
            },
          },
          renderValue: () => selectedOption?.label ?? (
            <Box component="span" sx={{ color: 'text.disabled' }}>
              {placeholder}
            </Box>
          ),
        },
      }}
      onChange={async (event) => {
        await api.setEditCellValue({
          id,
          field,
          value: event.target.value,
        });
      }}
    >
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}, (previous, next) => (
  previous.id === next.id
  && previous.field === next.field
  && previous.value === next.value
  && previous.hasFocus === next.hasFocus
  && previous.options === next.options
  && previous.placeholder === next.placeholder
));
