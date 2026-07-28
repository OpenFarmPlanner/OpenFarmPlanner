import type { Dispatch, SetStateAction } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";

import type { CultivationType } from "../../api/types";
import { useTranslation } from "../../i18n";
import {
  formatLocalizedNumber,
  parseLocalizedNumber,
} from "../../utils/numberLocalization";
import type { SearchableSelectOption } from "../data-grid";
import type { MobileCreateFormState } from "../../pages/plantingPlansUtils";
import type { CultivationTypeSelectOption } from "../../pages/usePlantingPlanHierarchy";
import { TypeaheadSelect as Select } from "../inputs/TypeaheadSelect";
import {
  compactFieldSx,
  formRowSx,
  fullWidthFieldSx,
  smallFieldSx,
  wideFieldSx,
} from "../forms/formLayout";

interface MobilePlanFormDialogProps {
  open: boolean;
  /** Edit mode changes only the title and submit label; the form is shared. */
  isEdit: boolean;
  form: MobileCreateFormState;
  setForm: Dispatch<SetStateAction<MobileCreateFormState>>;
  error: string;
  cultureOptions: SearchableSelectOption[];
  bedOptions: SearchableSelectOption[];
  cultivationTypeOptions: CultivationTypeSelectOption[];
  numberLocale: string;
  getPlantsPerSqm: (cultureId: string) => number | null;
  /** Called when the user edits one of the two linked area/plants inputs. */
  onLinkedFieldEdited: (field: "area_m2" | "plants_count") => void;
  onClose: () => void;
  onSubmit: () => void;
}

/**
 * Presentational mobile create/edit/duplicate form for a planting plan.
 * All state (form draft, edit id, error) and the submit handlers live in
 * PlantingPlans.tsx; this component only renders the dialog and keeps the
 * area ↔ plants-count inputs in sync while typing.
 */
export function MobilePlanFormDialog({
  open,
  isEdit,
  form,
  setForm,
  error,
  cultureOptions,
  bedOptions,
  cultivationTypeOptions,
  numberLocale,
  getPlantsPerSqm,
  onLinkedFieldEdited,
  onClose,
  onSubmit,
}: MobilePlanFormDialogProps) {
  const { t } = useTranslation(["plantingPlans", "common"]);

  const formatNumberForInput = (
    value: number,
    options?: Intl.NumberFormatOptions,
  ): string =>
    formatLocalizedNumber(value, numberLocale, {
      useGrouping: false,
      maximumFractionDigits: 6,
      ...options,
    });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {isEdit ? t("plantingPlans:mobile.editTitle") : t("plantingPlans:mobile.createTitle")}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <FormControl sx={wideFieldSx}>
            <InputLabel>{t("plantingPlans:columns.culture")}</InputLabel>
            <Select
              fullWidth
              value={form.culture}
              label={t("plantingPlans:columns.culture")}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, culture: String(event.target.value) }))
              }
            >
              {cultureOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={wideFieldSx}>
            <InputLabel>{t("plantingPlans:columns.bed")}</InputLabel>
            <Select
              fullWidth
              value={form.bed}
              label={t("plantingPlans:columns.bed")}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, bed: String(event.target.value) }))
              }
            >
              {bedOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={smallFieldSx}>
            <InputLabel>{t("plantingPlans:columns.cultivationType")}</InputLabel>
            <Select
              fullWidth
              value={form.cultivation_type}
              label={t("plantingPlans:columns.cultivationType")}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, cultivation_type: event.target.value as CultivationType }))
              }
            >
              {cultivationTypeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={formRowSx}>
            <TextField
              type="text"
              label={t("plantingPlans:columns.plantingDate")}
              placeholder={t('common:dateFormatPlaceholder')}
              InputLabelProps={{ shrink: true }}
              value={form.planting_date}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, planting_date: event.target.value }))
              }
              sx={compactFieldSx}
            />
            <TextField
              type="text"
              inputMode="decimal"
              label={t("plantingPlans:columns.areaM2")}
              value={form.area_m2}
              onChange={(event) => {
                const nextArea = event.target.value;
                const plantsPerSqm = getPlantsPerSqm(form.culture);
                const normalizedArea = nextArea.trim().toLowerCase();
                const maxKeyword = t("plantingPlans:placeholders.maxKeyword").toLowerCase();
                const parsedArea = normalizedArea === maxKeyword ? null : parseLocalizedNumber(nextArea, numberLocale);
                setForm((previous) => ({
                  ...previous,
                  area_m2: nextArea,
                  plants_count:
                    plantsPerSqm && parsedArea !== null
                      ? formatNumberForInput(
                          Math.round(parsedArea * plantsPerSqm),
                          { maximumFractionDigits: 0 },
                        )
                      : previous.plants_count,
                }));
                onLinkedFieldEdited("area_m2");
              }}
              placeholder={t("plantingPlans:placeholders.maxKeyword")}
              helperText={t("plantingPlans:tooltips.areaAutoMax")}
              slotProps={{ htmlInput: { inputMode: "decimal" } }}
              sx={compactFieldSx}
            />
            <TextField
              type="text"
              inputMode="numeric"
              label={t("plantingPlans:columns.plantsCount")}
              value={form.plants_count}
              onChange={(event) => {
                const nextPlants = event.target.value;
                const plantsPerSqm = getPlantsPerSqm(form.culture);
                const parsedPlants = parseLocalizedNumber(nextPlants, numberLocale);
                setForm((previous) => ({
                  ...previous,
                  plants_count: nextPlants,
                  area_m2:
                    plantsPerSqm && parsedPlants !== null
                      ? formatNumberForInput(parsedPlants / plantsPerSqm, {
                          maximumFractionDigits: 2,
                        })
                      : previous.area_m2,
                }));
                onLinkedFieldEdited("plants_count");
              }}
              slotProps={{ htmlInput: { inputMode: "numeric" } }}
              sx={compactFieldSx}
            />
          </Box>
          <TextField
            label={t("common:fields.notes")}
            multiline
            minRows={3}
            value={form.notes}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, notes: event.target.value }))
            }
            sx={fullWidthFieldSx}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("common:actions.cancel")}</Button>
        <Button onClick={onSubmit} variant="contained">
          {isEdit ? t("common:actions.save") : t("common:actions.add")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
