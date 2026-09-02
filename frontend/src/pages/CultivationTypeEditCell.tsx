import { memo, useCallback, useState } from "react";
import { Box, MenuItem, TextField } from "@mui/material";
import type { GridRenderEditCellParams } from "@mui/x-data-grid";
import { useClosedSelectTypeahead } from "../components/inputs/selectTypeahead";
import { useSelectEditCellOpenRequest } from "../components/data-grid/SelectEditCellContext";
import { useSelectMenuEnterCommit } from "../components/data-grid/useSelectMenuEnterCommit";
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
  const [open, setOpen] = useState(false);
  const selectedValue = normalizeCultivationType(value) ?? "";
  const selectedOption = options.find((option) => option.value === selectedValue);
  const handleOpen = useCallback((): void => {
    setOpen(true);
  }, []);
  const notifyMenuClose = useSelectEditCellOpenRequest(id, field, handleOpen);
  const handleClose = useCallback((event: unknown): void => {
    setOpen(false);
    notifyMenuClose(event);
  }, [notifyMenuClose]);
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
      value={selectedValue}
      slotProps={{
        htmlInput: {
          tabIndex: hasFocus ? 0 : -1,
        },
        select: {
          displayEmpty: true,
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
