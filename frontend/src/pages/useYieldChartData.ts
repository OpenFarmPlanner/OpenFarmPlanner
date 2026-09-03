import { useMemo } from "react";
import { type YieldCalendarWeek } from "../api/api";
import { parseDateString } from "./ganttChartUtils";
import {
  ALL_CROPS,
  formatIsoWeek,
  mergeCropYields,
  type ChartPeriod,
  type YieldCalendarCrop,
  type YieldCropMeta,
} from "./yieldOverviewUtils";
import { getCropDisplayName } from "../crops/cropDisplay";
import { formatDateToAPI } from '../utils/isoDate';

export interface YieldChartCrop extends YieldCropMeta {
  totalYield: number;
}

export interface YieldChartColumn {
  id: string;
  startDate: string;
  primaryLabel: string;
  secondaryLabel: string;
  crops: YieldCalendarCrop[];
  totalYield: number;
}

/**
 * Shapes the raw weekly yield rows into chart columns (grouped by week or
 * month) plus the legend crops ordered by total visible yield. Memoized on
 * its inputs so the chart only recomputes when the data, filter, period, or
 * locale changes.
 */
export function useYieldChartData(
  weeklyYield: YieldCalendarWeek[],
  selectedCropId: string,
  period: ChartPeriod,
  locale: string,
) {
  return useMemo(() => {
    const cropMeta = new Map<number, YieldCropMeta>();
    weeklyYield.forEach((week) => {
      week.crops.forEach((crop) => {
        cropMeta.set(crop.crop_id, {
          id: crop.crop_id,
          name: getCropDisplayName(crop),
          color: crop.color,
        });
      });
    });

    const availableCrops = [...cropMeta.values()].sort((left, right) =>
      left.name.localeCompare(right.name, locale),
    );
    const selectedCrop =
      selectedCropId === ALL_CROPS
        ? null
        : Number(selectedCropId);
    const filterCrops = (
      crops: YieldCalendarCrop[],
    ): YieldCalendarCrop[] =>
      selectedCrop === null
        ? crops
        : crops.filter((crop) => crop.crop_id === selectedCrop);

    const sortedByStart = [...weeklyYield].sort((left, right) =>
      left.week_start.localeCompare(right.week_start),
    );
    if (sortedByStart.length === 0) {
      return {
        chartData: [] as YieldChartColumn[],
        chartCrops: [] as YieldChartCrop[],
        availableCrops,
        yearBoundary: null as {
          columnId: string;
          year1: number;
          year2: number;
        } | null,
        maxTotalYield: 0,
      };
    }

    const startDate = parseDateString(sortedByStart[0].week_start);
    const endDate = parseDateString(
      sortedByStart[sortedByStart.length - 1].week_start,
    );
    const weekMap = new Map(weeklyYield.map((week) => [week.week_start, week]));
    const weeklyColumns: YieldChartColumn[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const weekStart = formatDateToAPI(currentDate);
      const week = weekMap.get(weekStart);
      const crops = filterCrops(week?.crops ?? []);
      const weekStartDate = parseDateString(weekStart);
      const isoWeek = week?.iso_week ?? formatIsoWeek(weekStartDate);
      weeklyColumns.push({
        id: isoWeek,
        startDate: weekStart,
        primaryLabel: isoWeek.split("-W")[1]
          ? `W${isoWeek.split("-W")[1]}`
          : isoWeek,
        secondaryLabel: weekStartDate.toLocaleDateString(locale, {
          month: "short",
        }),
        crops,
        totalYield: crops.reduce((sum, crop) => sum + crop.yield, 0),
      });
      currentDate.setDate(currentDate.getDate() + 7);
    }

    const chartData =
      period === "week"
        ? weeklyColumns
        : [...weeklyColumns.reduce((months, column) => {
            const sourceDate = parseDateString(column.startDate);
            const monthId = `${sourceDate.getFullYear()}-${String(sourceDate.getMonth() + 1).padStart(2, "0")}`;
            const existing = months.get(monthId);
            const crops = mergeCropYields([
              ...(existing?.crops ?? []),
              ...column.crops,
            ]);
            months.set(monthId, {
              id: monthId,
              startDate: `${monthId}-01`,
              primaryLabel: sourceDate.toLocaleDateString(locale, {
                month: "short",
              }),
              secondaryLabel: String(sourceDate.getFullYear()),
              crops,
              totalYield: crops.reduce(
                (sum, crop) => sum + crop.yield,
                0,
              ),
            });
            return months;
          }, new Map<string, YieldChartColumn>()).values()];

    // The legend orders crops by their total yield in the currently
    // visible data (descending) rather than alphabetically, so the most
    // relevant crops always appear first — this also determines which
    // ones are shown first once the legend is collapsed to a subset.
    const totalYieldByCropId = new Map<number, number>();
    chartData.forEach((column) => {
      column.crops.forEach((crop) => {
        totalYieldByCropId.set(
          crop.crop_id,
          (totalYieldByCropId.get(crop.crop_id) ?? 0) + crop.yield,
        );
      });
    });
    const chartCrops: YieldChartCrop[] = availableCrops
      .filter((crop) => totalYieldByCropId.has(crop.id))
      .map((crop) => ({
        ...crop,
        totalYield: totalYieldByCropId.get(crop.id) ?? 0,
      }))
      .sort((left, right) => (
        right.totalYield - left.totalYield
      ));

    // The single index where the visible columns cross a calendar-year
    // boundary (Dec → Jan). At most one exists within a ~12-month season.
    // `columnId` is the first column of the new year; the marker renders on
    // its leading edge.
    const columnYear = (column: YieldChartColumn): number =>
      period === "week"
        ? parseDateString(column.startDate).getFullYear()
        : Number(column.id.split("-")[0]);
    let yearBoundary: { columnId: string; year1: number; year2: number } | null =
      null;
    for (let index = 1; index < chartData.length; index += 1) {
      const previousYear = columnYear(chartData[index - 1]);
      const currentYear = columnYear(chartData[index]);
      if (previousYear !== currentYear) {
        yearBoundary = {
          columnId: chartData[index].id,
          year1: previousYear,
          year2: currentYear,
        };
        break;
      }
    }

    return {
      chartData,
      chartCrops,
      availableCrops,
      yearBoundary,
      maxTotalYield: chartData.reduce(
        (max, column) => Math.max(max, column.totalYield),
        0,
      ),
    };
  }, [locale, period, selectedCropId, weeklyYield]);
}
