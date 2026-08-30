import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useYieldChartData } from "../pages/useYieldChartData";
import { ALL_CULTURES } from "../pages/yieldOverviewUtils";
import type { YieldCalendarWeek } from "../api/api";

const week = (isoWeek: string, weekStart: string): YieldCalendarWeek => ({
  iso_week: isoWeek,
  week_start: weekStart,
  week_end: weekStart,
  cultures: [
    {
      culture_id: 1,
      culture_name: "Kohl",
      culture_display_name: "Kohl",
      culture_display_language_code: "de",
      color: "#16a34a",
      yield: 1,
    },
  ],
});

describe("useYieldChartData year boundary", () => {
  it("marks the week where the calendar year changes", () => {
    const data = [week("2025-W52", "2025-12-22"), week("2026-W02", "2026-01-05")];
    const { result } = renderHook(() =>
      useYieldChartData(data, ALL_CULTURES, "week", "de"),
    );

    expect(result.current.yearBoundary).toEqual({
      columnId: "2026-W02",
      year1: 2025,
      year2: 2026,
    });
  });

  it("marks the month where the calendar year changes in month view", () => {
    const data = [week("2025-W52", "2025-12-22"), week("2026-W02", "2026-01-05")];
    const { result } = renderHook(() =>
      useYieldChartData(data, ALL_CULTURES, "month", "de"),
    );

    expect(result.current.yearBoundary).toEqual({
      columnId: "2026-01",
      year1: 2025,
      year2: 2026,
    });
  });

  it("returns no boundary when all data is within one calendar year", () => {
    const data = [week("2026-W02", "2026-01-05"), week("2026-W05", "2026-01-26")];
    const { result } = renderHook(() =>
      useYieldChartData(data, ALL_CULTURES, "week", "de"),
    );

    expect(result.current.yearBoundary).toBeNull();
  });
});
