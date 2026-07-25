import { useMemo } from "react";
import { type YieldCalendarWeek } from "../api/api";
import { parseDateString } from "./ganttChartUtils";
import {
  ALL_CULTURES,
  formatDateToAPI,
  formatIsoWeek,
  mergeCultureYields,
  type ChartPeriod,
  type YieldCalendarCulture,
  type YieldCultureMeta,
} from "./yieldOverviewUtils";

export interface YieldChartCulture extends YieldCultureMeta {
  totalYield: number;
}

export interface YieldChartColumn {
  id: string;
  startDate: string;
  primaryLabel: string;
  secondaryLabel: string;
  cultures: YieldCalendarCulture[];
  totalYield: number;
}

/**
 * Shapes the raw weekly yield rows into chart columns (grouped by week or
 * month) plus the legend cultures ordered by total visible yield. Memoized on
 * its inputs so the chart only recomputes when the data, filter, period, or
 * locale changes.
 */
export function useYieldChartData(
  weeklyYield: YieldCalendarWeek[],
  selectedCultureId: string,
  period: ChartPeriod,
  locale: string,
) {
  return useMemo(() => {
    const cultureMeta = new Map<number, YieldCultureMeta>();
    weeklyYield.forEach((week) => {
      week.cultures.forEach((culture) => {
        cultureMeta.set(culture.culture_id, {
          id: culture.culture_id,
          name: culture.culture_name,
          color: culture.color,
        });
      });
    });

    const availableCultures = [...cultureMeta.values()].sort((left, right) =>
      left.name.localeCompare(right.name, locale),
    );
    const selectedCulture =
      selectedCultureId === ALL_CULTURES
        ? null
        : Number(selectedCultureId);
    const filterCultures = (
      cultures: YieldCalendarCulture[],
    ): YieldCalendarCulture[] =>
      selectedCulture === null
        ? cultures
        : cultures.filter((culture) => culture.culture_id === selectedCulture);

    const sortedByStart = [...weeklyYield].sort((left, right) =>
      left.week_start.localeCompare(right.week_start),
    );
    if (sortedByStart.length === 0) {
      return {
        chartData: [] as YieldChartColumn[],
        chartCultures: [] as YieldChartCulture[],
        availableCultures,
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
      const cultures = filterCultures(week?.cultures ?? []);
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
        cultures,
        totalYield: cultures.reduce((sum, culture) => sum + culture.yield, 0),
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
            const cultures = mergeCultureYields([
              ...(existing?.cultures ?? []),
              ...column.cultures,
            ]);
            months.set(monthId, {
              id: monthId,
              startDate: `${monthId}-01`,
              primaryLabel: sourceDate.toLocaleDateString(locale, {
                month: "short",
              }),
              secondaryLabel: String(sourceDate.getFullYear()),
              cultures,
              totalYield: cultures.reduce(
                (sum, culture) => sum + culture.yield,
                0,
              ),
            });
            return months;
          }, new Map<string, YieldChartColumn>()).values()];

    // The legend orders cultures by their total yield in the currently
    // visible data (descending) rather than alphabetically, so the most
    // relevant cultures always appear first — this also determines which
    // ones are shown first once the legend is collapsed to a subset.
    const totalYieldByCultureId = new Map<number, number>();
    chartData.forEach((column) => {
      column.cultures.forEach((culture) => {
        totalYieldByCultureId.set(
          culture.culture_id,
          (totalYieldByCultureId.get(culture.culture_id) ?? 0) + culture.yield,
        );
      });
    });
    const chartCultures: YieldChartCulture[] = availableCultures
      .filter((culture) => totalYieldByCultureId.has(culture.id))
      .map((culture) => ({
        ...culture,
        totalYield: totalYieldByCultureId.get(culture.id) ?? 0,
      }))
      .sort((left, right) => (
        right.totalYield - left.totalYield
      ));

    return {
      chartData,
      chartCultures,
      availableCultures,
      maxTotalYield: chartData.reduce(
        (max, column) => Math.max(max, column.totalYield),
        0,
      ),
    };
  }, [locale, period, selectedCultureId, weeklyYield]);
}
