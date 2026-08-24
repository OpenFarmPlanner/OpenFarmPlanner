/**
 * Edit cell for plants_count field in PlantingPlans grid.
 * 
 * Keeps raw input text during editing and lets the save flow normalize it.
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { TextField } from '@mui/material';
import { useGridApiContext } from '@mui/x-data-grid';
import type { GridRenderEditCellParams } from '@mui/x-data-grid';
import type { Culture } from '../../api/types';
import { useEditCellNavigation } from './EditCellNavigationContext';
import { useEditCellAutoFocus } from './useEditCellAutoFocus';

export interface PlantsCountEditCellProps extends GridRenderEditCellParams {
  cultures: Culture[];
  onLastEditedFieldChange: (field: 'plants_count') => void;
  placeholder?: string;
}

export function PlantsCountEditCell(props: PlantsCountEditCellProps) {
  const { id, value, field, hasFocus, onLastEditedFieldChange, placeholder } = props;
  const apiRef = useGridApiContext();
  const editCellNavigation = useEditCellNavigation();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [inputValue, setInputValue] = useState<string>(
    typeof value === 'number' && !isNaN(value) ? value.toString() : ''
  );
  const displayedInputValue = hasFocus
    ? inputValue
    : typeof value === 'number' && !isNaN(value) ? value.toString() : typeof value === 'string' ? value : '';

  const selectAll = useCallback((input: HTMLInputElement): void => {
    input.select();
  }, []);
  useEditCellAutoFocus(hasFocus, inputRef, selectAll);

  useEffect(() => {
    const input = inputRef.current;
    if (!input || !editCellNavigation) {
      return undefined;
    }

    const handleNativeTabKeyDown = (event: globalThis.KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.stopPropagation();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      editCellNavigation({
        id,
        field,
        event: {
          altKey: event.altKey,
          ctrlKey: event.ctrlKey,
          key: event.key,
          metaKey: event.metaKey,
          nativeEvent: event,
          preventDefault: () => event.preventDefault(),
          shiftKey: event.shiftKey,
          stopPropagation: () => event.stopPropagation(),
        },
      });
    };

    input.addEventListener('keydown', handleNativeTabKeyDown, { capture: true });
    return () => {
      input.removeEventListener('keydown', handleNativeTabKeyDown, { capture: true });
    };
  }, [editCellNavigation, field, id]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    void apiRef.current.setEditCellValue({
      id,
      field,
      value: val
    });
    
    onLastEditedFieldChange('plants_count');
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.stopPropagation();
      return;
    }

    if (event.key === 'Tab') {
      editCellNavigation?.({
        id,
        field,
        event: event as ReactKeyboardEvent<HTMLElement>,
      });
    }
  };
  
  return (
    <TextField
      type="text"
      inputMode="numeric"
      inputRef={inputRef}
      value={displayedInputValue}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      slotProps={{
        htmlInput: {
          min: 0,
          step: 1,
          tabIndex: 0,
        },
      }}
      size="small"
      fullWidth
      sx={{ '& .MuiInputBase-root': { height: '100%' } }}
    />
  );
}
