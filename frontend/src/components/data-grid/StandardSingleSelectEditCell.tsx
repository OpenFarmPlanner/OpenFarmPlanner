import { memo, useCallback, useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { GridRenderEditCellParams } from '@mui/x-data-grid';
import { Box, MenuItem, TextField } from '@mui/material';
import { useClosedSelectTypeahead } from '../inputs/selectTypeahead';
import type { SearchableSelectOption } from './SearchableSelectEditCell';
import { useSelectEditCellOpenRequest } from './SelectEditCellContext';

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
  const handleMenuKeyDown = useCallback((event: ReactKeyboardEvent<HTMLUListElement>): void => {
    if (
      event.key !== 'Enter'
      || event.altKey
      || event.ctrlKey
      || event.metaKey
    ) {
      return;
    }

    const selectedElement = event.currentTarget.querySelector<HTMLElement>(
      '[role="option"].Mui-focusVisible, [role="option"].Mui-selected, [role="option"][aria-selected="true"]',
    );
    const nextValue = selectedElement?.getAttribute('data-value');
    const nextOption = nextValue
      ? options.find((option) => String(option.value) === nextValue)
      : undefined;
    if (!nextOption) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation?.();
    void api.setEditCellValue({
      id,
      field,
      value: nextOption.value,
    });
    setOpen(false);
    notifyMenuClose(event);
  }, [api, field, id, notifyMenuClose, options]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleDocumentKeyDownCapture = (event: globalThis.KeyboardEvent): void => {
      if (
        event.key !== 'Enter'
        || event.altKey
        || event.ctrlKey
        || event.metaKey
      ) {
        return;
      }

      const activeElement = document.activeElement;
      const selectedElement = (
        activeElement instanceof HTMLElement
          ? activeElement.closest<HTMLElement>('[role="option"]')
          : null
      ) ?? document.querySelector<HTMLElement>(
          '[role="listbox"] [role="option"].Mui-focusVisible, [role="listbox"] [role="option"].Mui-selected, [role="listbox"] [role="option"][aria-selected="true"]',
        );
      const nextValue = selectedElement?.getAttribute('data-value');
      const nextOption = nextValue
        ? options.find((option) => String(option.value) === nextValue)
        : undefined;
      if (!nextOption) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      void api.setEditCellValue({
        id,
        field,
        value: nextOption.value,
      });
      setOpen(false);
      notifyMenuClose(event);
    };

    document.addEventListener('keydown', handleDocumentKeyDownCapture, true);
    return () => document.removeEventListener('keydown', handleDocumentKeyDownCapture, true);
  }, [api, field, id, notifyMenuClose, open, options]);

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
