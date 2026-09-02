import { useCallback, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { GridRowId } from '@mui/x-data-grid';
import { useClosedSelectTypeahead } from '../inputs/selectTypeahead';
import type { SelectTypeaheadOption } from '../inputs/selectTypeahead';
import { useSelectEditCellOpenRequest } from './SelectEditCellContext';
import { useSelectMenuEnterCommit } from './useSelectMenuEnterCommit';

/**
 * Shared wiring for the single-select edit cells: menu open/close state kept in
 * sync with the grid's select-open requests, closed-select typeahead, and the
 * Enter-to-commit handling. Callers keep their own rendering, which is where the
 * cells legitimately differ (value normalization, placeholder, truncation).
 */

interface EditCellValueSetter {
  setEditCellValue: (params: { id: GridRowId; field: string; value: string | number }) => unknown;
}

interface UseSingleSelectEditCellConfig<V extends string | number> {
  id: GridRowId;
  field: string;
  api: EditCellValueSetter;
  options: SelectTypeaheadOption<V>[];
  /** Current value in the option value's own type, used for typeahead matching. */
  typeaheadValue: V;
}

interface SingleSelectEditCellHandlers {
  open: boolean;
  handleOpen: () => void;
  handleClose: (event: unknown) => void;
  handleSelectKeyDown: (event: ReactKeyboardEvent<Element>) => void;
  handleMenuKeyDown: (event: ReactKeyboardEvent<HTMLUListElement>) => void;
}

export function useSingleSelectEditCell<V extends string | number>({
  id,
  field,
  api,
  options,
  typeaheadValue,
}: UseSingleSelectEditCellConfig<V>): SingleSelectEditCellHandlers {
  const [open, setOpen] = useState(false);

  const handleOpen = useCallback((): void => {
    setOpen(true);
  }, []);

  const notifyMenuClose = useSelectEditCellOpenRequest(id, field, handleOpen);

  const handleClose = useCallback((event: unknown): void => {
    setOpen(false);
    notifyMenuClose(event);
  }, [notifyMenuClose]);

  const handleTypeaheadSelect = useCallback((nextValue: V | V[]): void => {
    const selectedValue = Array.isArray(nextValue) ? nextValue[0] : nextValue;
    void api.setEditCellValue({
      id,
      field,
      value: selectedValue,
    });
  }, [api, field, id]);

  const handleSelectKeyDown = useClosedSelectTypeahead<V>({
    options,
    value: typeaheadValue,
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

  return { open, handleOpen, handleClose, handleSelectKeyDown, handleMenuKeyDown };
}
