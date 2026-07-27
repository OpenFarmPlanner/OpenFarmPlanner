import { type YieldCalendarWeek } from "../api/api";

export type ChartPeriod = "week" | "month";

/** Sentinel filter value representing "all cultures" in the yield overview. */
export const ALL_CULTURES = "all";

export interface YieldCultureMeta {
  id: number;
  name: string;
  color: string;
}

export type YieldCalendarCulture = YieldCalendarWeek["cultures"][number];

export function formatCompactYield(value: number, locale: string): string {
  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: value < 10 ? 1 : 0,
  });

  return formatter.format(value);
}

/** Formats a Date as YYYY-MM-DD using the local calendar date. */
export function formatDateToAPI(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Returns the ISO-8601 week identifier (e.g. "2024-W05") for the given date. */
export function formatIsoWeek(date: Date): string {
  const utcDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil(
    ((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${utcDate.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

/** Sums the yields of culture entries sharing the same culture id. */
export function mergeCultureYields(
  cultures: YieldCalendarCulture[],
): YieldCalendarCulture[] {
  const totals = new Map<number, YieldCalendarCulture>();

  cultures.forEach((culture) => {
    const existing = totals.get(culture.culture_id);
    totals.set(culture.culture_id, {
      ...culture,
      yield: (existing?.yield ?? 0) + culture.yield,
    });
  });

  return [...totals.values()];
}

const WEEK_LABEL_MIN_WIDTH = 36;
const MONTH_LABEL_MIN_WIDTH = 56;

export function getYieldAxisLabelStep(
  availableWidth: number,
  columnCount: number,
  period: ChartPeriod,
): number {
  if (availableWidth <= 0 || columnCount <= 1) {
    return 1;
  }

  const minimumLabelWidth =
    period === "week" ? WEEK_LABEL_MIN_WIDTH : MONTH_LABEL_MIN_WIDTH;
  const columnWidth = availableWidth / columnCount;
  return Math.max(1, Math.ceil(minimumLabelWidth / columnWidth));
}
