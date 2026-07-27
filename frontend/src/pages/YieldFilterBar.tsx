import {
  FormControl,
  MenuItem,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  segmentedToggleButtonGroupSx,
  segmentedToggleButtonSx,
} from "../components/buttons/segmentedControlStyles";
import { TypeaheadSelect as Select } from "../components/inputs/TypeaheadSelect";
import { useTranslation } from "../i18n";
import {
  ALL_CULTURES,
  type ChartPeriod,
  type YieldCultureMeta,
} from "./yieldOverviewUtils";

interface YieldFilterBarProps {
  cultures: YieldCultureMeta[];
  selectedCultureId: string;
  selectedYear: number;
  period: ChartPeriod;
  onCultureChange: (cultureId: string) => void;
  onYearChange: (year: number) => void;
  onPeriodChange: (period: ChartPeriod) => void;
}

export function YieldFilterBar({
  cultures,
  selectedCultureId,
  selectedYear,
  period,
  onCultureChange,
  onYearChange,
  onPeriodChange,
}: YieldFilterBarProps) {
  const { t } = useTranslation("yieldOverview");
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from(
    { length: 6 },
    (_, index) => currentYear - 2 + index,
  );

  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1.5}
      alignItems={{ xs: "stretch", sm: "flex-start" }}
      sx={{ width: "100%", flexWrap: "wrap" }}
    >
      <Stack spacing={0.5} sx={{ minWidth: { sm: 220 } }}>
        <Typography
          id="yield-culture-filter-label"
          variant="caption"
          color="text.secondary"
          sx={{ lineHeight: 1 }}
        >
          {t("filters.culture")}
        </Typography>
        <FormControl size="small" fullWidth>
          <Select
            fullWidth
            labelId="yield-culture-filter-label"
            value={selectedCultureId}
            onChange={(event) => onCultureChange(String(event.target.value))}
          >
            <MenuItem value={ALL_CULTURES}>{t("filters.allCultures")}</MenuItem>
            {cultures.map((culture) => (
              <MenuItem key={culture.id} value={String(culture.id)}>
                {culture.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Stack spacing={0.5} sx={{ minWidth: { sm: 120 } }}>
        <Typography
          id="yield-year-filter-label"
          variant="caption"
          color="text.secondary"
          sx={{ lineHeight: 1 }}
        >
          {t("filters.year")}
        </Typography>
        <FormControl size="small" fullWidth>
          <Select
            fullWidth
            labelId="yield-year-filter-label"
            value={String(selectedYear)}
            onChange={(event) => onYearChange(Number(event.target.value))}
          >
            {yearOptions.map((year) => (
              <MenuItem key={year} value={String(year)}>
                {year}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Stack spacing={0.5}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ lineHeight: 1 }}
        >
          {t("filters.period")}
        </Typography>
        <ToggleButtonGroup
          value={period}
          exclusive
          size="small"
          color="primary"
          aria-label={t("filters.period")}
          sx={{ ...segmentedToggleButtonGroupSx, height: 40 }}
          onChange={(_, value: ChartPeriod | null) => {
            if (value !== null) {
              onPeriodChange(value);
            }
          }}
        >
          <ToggleButton value="week" sx={segmentedToggleButtonSx}>
            {t("filters.week")}
          </ToggleButton>
          <ToggleButton value="month" sx={segmentedToggleButtonSx}>
            {t("filters.month")}
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>
    </Stack>
  );
}
