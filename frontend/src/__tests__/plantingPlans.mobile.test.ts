import { describe, expect, it } from "vitest";
import {
  buildAreaColumnHeaderLabel,
  buildMobileCreateForm,
  getVisibleMobileRows,
} from "../pages/plantingPlansUtils";

describe("PlantingPlans mobile create helpers", () => {
  it("prefills selected bed but leaves area empty in the mobile create form", () => {
    const form = buildMobileCreateForm({ bedId: 12 });

    expect(form.bed).toBe("12");
    expect(form.area_m2).toBe("");
    expect(form.cultivation_type).toBe("pre_cultivation");
  });

  it("filters draft rows from mobile card rendering", () => {
    const rows = [
      { id: 1, isNew: false, culture: 1, bed: 1, planting_date: "2026-04-01" },
      { id: -1, isNew: true, culture: 0, bed: 0, planting_date: "" },
    ] as Array<{
      id: number;
      isNew: boolean;
      culture: number;
      bed: number;
      planting_date: string;
    }>;

    const visibleRows = getVisibleMobileRows(rows as never);

    expect(visibleRows).toHaveLength(1);
    expect(visibleRows[0].id).toBe(1);
  });

  it("builds area column header with location for multi-location projects", () => {
    expect(
      buildAreaColumnHeaderLabel(true, "Standort", "Parzelle", "Beet"),
    ).toBe("Standort | Parzelle | Beet");
  });

  it("builds area column header without location for single-location projects", () => {
    expect(
      buildAreaColumnHeaderLabel(false, "Standort", "Parzelle", "Beet"),
    ).toBe("Parzelle | Beet");
  });
});
