/**
 * Edit cell for area_m2 field in PlantingPlans grid.
 *
 * Provides a numeric input for area editing with optional normalization on blur.
 */

import { memo, useCallback, useRef, useState } from 'react';
import { TextField } from '@mui/material';
import { useGridApiContext } from '@mui/x-data-grid';
import type { GridRenderEditCellParams } from '@mui/x-data-grid';
import { getInitialInputValue } from './areaM2EditCellValue';
import { useEditCellAutoFocus } from './useEditCellAutoFocus';

export interface AreaM2EditCellProps extends GridRenderEditCellParams {
  onLastEditedFieldChange: (field: 'area_m2') => void;
  fallbackValue?: number | null;
  locale: string;
  maxKeyword: string;
  maxPlaceholder: string;
}

function AreaM2EditCellComponent(props: AreaM2EditCellProps) {
  const {
    id,
    value,
    field,
    hasFocus,
    onLastEditedFieldChange,
    fallbackValue,
    locale,
    maxPlaceholder,
  } = props;
  const apiRef = useGridApiContext();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [inputValue, setInputValue] = useState<string>(
    () => getInitialInputValue(value, fallbackValue, locale)
  );
  const displayedInputValue = hasFocus
    ? inputValue
    : getInitialInputValue(value, fallbackValue, locale);

  const selectAll = useCallback((input: HTMLInputElement): void => {
    input.select();
  }, []);
  useEditCellAutoFocus(hasFocus, inputRef, selectAll);

  const applyValue = async (nextValue: string): Promise<void> => {
    onLastEditedFieldChange('area_m2');
    await apiRef.current.setEditCellValue({
      id,
      field,
      value: nextValue,
    });
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const val = e.target.value;
    setInputValue(val);
    await applyValue(val);
  };

  return (
    <TextField
      type="text"
      inputMode="decimal"
      inputRef={inputRef}
      value={displayedInputValue}
      onChange={handleChange}
      size="small"
      fullWidth
      placeholder={maxPlaceholder}
      slotProps={{
        htmlInput: {
          min: 0,
          step: 0.01,
          tabIndex: hasFocus ? 0 : -1,
        },
      }}
      sx={{
        minWidth: 96,
        flex: 1,
        '& .MuiInputBase-root': {
          height: '100%',
          outline: 'none',
          boxShadow: 'none',
        },
        '& .MuiOutlinedInput-notchedOutline': {
          border: 0,
        },
        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
          border: 0,
        },
        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
          border: 0,
        },
      }}
    />
  );
}

export const AreaM2EditCell = memo(AreaM2EditCellComponent, (previous, next) => (
  previous.id === next.id
  && previous.field === next.field
  && previous.value === next.value
  && previous.hasFocus === next.hasFocus
  && previous.fallbackValue === next.fallbackValue
  && previous.locale === next.locale
  && previous.maxKeyword === next.maxKeyword
  && previous.maxPlaceholder === next.maxPlaceholder
));
