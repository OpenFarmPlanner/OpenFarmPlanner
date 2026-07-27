import { memo, useCallback } from "react";
import { Box, MenuItem, TextField } from "@mui/material";
import type { GridRenderEditCellParams } from "@mui/x-data-grid";
import { useClosedSelectTypeahead } from "../components/inputs/selectTypeahead";
import { normalizeCultivationType } from "./plantingPlansUtils";
import type { CultivationTypeSelectOption } from "./usePlantingPlanHierarchy";

interface CultivationTypeEditCellProps extends GridRenderEditCellParams {
  options: CultivationTypeSelectOption[];
  placeholder: string;
}

export const CultivationTypeEditCell = memo(function CultivationTypeEditCell({
  id,
  field,
  value,
  hasFocus,
  api,
  options,
  placeholder,
}: CultivationTypeEditCellProps) {
  const selectedValue = normalizeCultivationType(value) ?? "";
  const selectedOption = options.find((option) => option.value === selectedValue);
  const handleTypeaheadSelect = useCallback((nextValue: string | string[]): void => {
    const nextSelectedValue = Array.isArray(nextValue) ? nextValue[0] : nextValue;
    void api.setEditCellValue({
      id,
      field,
      value: nextSelectedValue,
    });
  }, [api, field, id]);
  const handleSelectKeyDown = useClosedSelectTypeahead<string>({
    options,
    value: selectedValue,
    onSelect: handleTypeaheadSelect,
  });

  return (
    <TextField
      select
      fullWidth
      size="small"
      autoFocus={hasFocus}
      value={selectedValue}
      slotProps={{
        htmlInput: {
          tabIndex: hasFocus ? 0 : -1,
        },
        select: {
          displayEmpty: true,
          onKeyDown: handleSelectKeyDown,
          renderValue: () => selectedOption?.label ?? (
            <Box
              component="span"
              sx={{
                display: "block",
                minWidth: 0,
                overflow: "hidden",
                color: "text.disabled",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {placeholder}
            </Box>
          ),
        },
      }}
      sx={{
        "& .MuiSelect-select": {
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
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
