import { memo, useCallback, useState } from 'react';
import type { GridRenderEditCellParams } from '@mui/x-data-grid';
import { Box, MenuItem, TextField } from '@mui/material';
import { useClosedSelectTypeahead } from '../inputs/selectTypeahead';
import type { SearchableSelectOption } from './SearchableSelectEditCell';
import { useSelectEditCellOpenRequest } from './SelectEditCellContext';
import { useSelectMenuEnterCommit } from './useSelectMenuEnterCommit';

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
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);
  const handleOpen = useCallback((): void => {
    setOpen(true);
  }, []);
  const notifyMenuClose = useSelectEditCellOpenRequest(id, field, handleOpen);
  const handleClose = useCallback((event: unknown): void => {
    setOpen(false);
    notifyMenuClose(event);
  }, [notifyMenuClose]);
  const handleTypeaheadSelect = useCallback((nextValue: number | number[]): void => {
    const selectedValue = Array.isArray(nextValue) ? nextValue[0] : nextValue;
    void api.setEditCellValue({
      id,
      field,
      value: selectedValue,
    });
  }, [api, field, id]);
  const handleSelectKeyDown = useClosedSelectTypeahead<number>({
    options,
    value: typeof value === 'number' ? value : Number(value),
    onSelect: handleTypeaheadSelect,
  });
  const handleMenuKeyDown = useSelectMenuEnterCommit({
    open,
    options,
    api,
    id,
    field,
    setOpen,
    notifyMenuClose,
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
