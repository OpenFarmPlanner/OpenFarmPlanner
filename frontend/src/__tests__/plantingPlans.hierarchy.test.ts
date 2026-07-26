import { describe, expect, it } from "vitest";
import type { Bed, Field } from "../api/types";
import {
  collectHierarchyAvailability,
  filterBedOptionsBySelection,
  filterFieldOptionsByLocation,
} from "../components/planting-plans/areaHierarchySelection";
import {
  buildAreaColumnHeaderLabel,
  buildBedDisplayLabel,
  normalizeSelectionAfterBedChange,
  normalizeSelectionAfterFieldChange,
  normalizeSelectionAfterLocationChange,
  resolveBedCellValue,
} from "../pages/plantingPlansUtils";

const fields: Field[] = [
  { id: 10, name: "Parzelle Nord", location: 1 },
  { id: 20, name: "Parzelle Süd", location: 2 },
];

const beds: Bed[] = [
  { id: 100, name: "Beet 1", field: 10, area_sqm: 7 },
  { id: 200, name: "Beet 1", field: 20, area_sqm: 5 },
];

describe("PlantingPlans hierarchy normalization", () => {
  it("builds combined area column header labels with pipe separators", () => {
    expect(
      buildAreaColumnHeaderLabel(true, "Standort", "Parzelle", "Beet"),
    ).toBe("Standort | Parzelle | Beet");
    expect(
      buildAreaColumnHeaderLabel(false, "Standort", "Parzelle", "Beet"),
    ).toBe("Parzelle | Beet");
  });

  it("builds combined bed labels with optional area", () => {
    expect(
      buildBedDisplayLabel(
        "Sonnengarten",
        "Parzelle Nord",
        "Beet 1",
        7,
        true,
        "de-DE",
      ),
    ).toBe("Sonnengarten | Parzelle Nord | Beet 1 (7,00\u00a0m²)");
  });

  it("keeps the numeric bed ID when the grid cell value is a composed label", () => {
    const row = { location_id: 1, field_id: 10, bed: 100 };

    expect(
      resolveBedCellValue("Sonnengarten | Parzelle Nord | Beet 1", row),
    ).toBe(100);
    expect(resolveBedCellValue(200, row)).toBe(200);
  });

  it("excludes locations and fields without beds from availability", () => {
    const allFields: Field[] = [
      ...fields,
      { id: 30, name: "Parzelle Ost", location: 3 },
    ];
    const availability = collectHierarchyAvailability(allFields, beds);

    expect(Array.from(availability.fieldIdsWithBeds).sort()).toEqual([10, 20]);
    expect(Array.from(availability.locationIdsWithBeds).sort()).toEqual([1, 2]);
    expect(availability.locationIdsWithBeds.has(3)).toBe(false);
    expect(availability.fieldIdsWithBeds.has(30)).toBe(false);
  });

  it("filters field options immediately from the locally selected location", () => {
    const allFields: Field[] = [
      ...fields,
      { id: 30, name: "Parzelle Ost", location: 1 },
    ];
    const availability = collectHierarchyAvailability(allFields, beds);
    const filtered = filterFieldOptionsByLocation(2, allFields, availability.fieldIdsWithBeds);

    expect(filtered.map((field) => field.id)).toEqual([20]);
  });

  it("filters bed options immediately from local field selection", () => {
    const availability = collectHierarchyAvailability(fields, beds);
    const filtered = filterBedOptionsBySelection(1, 10, fields, beds, availability.fieldIdsWithBeds);

    expect(filtered.map((bed) => bed.id)).toEqual([100]);
  });

  it("resets field and bed when location no longer matches", () => {
    const row = { location_id: 1, field_id: 10, bed: 100 };

    const next = normalizeSelectionAfterLocationChange(row, 2, fields, beds);

    expect(next.location_id).toBe(2);
    expect(next.field_id).toBeUndefined();
    expect(next.bed).toBe(0);
  });

  it("keeps location/field/bed aligned when field changes", () => {
    const row = { location_id: 1, field_id: 10, bed: 100 };

    const next = normalizeSelectionAfterFieldChange(row, 20, fields, beds);

    expect(next.location_id).toBe(2);
    expect(next.field_id).toBe(20);
    expect(next.bed).toBe(0);
  });

  it("fills location and field from selected bed", () => {
    const row = { location_id: 1, field_id: 10, bed: 100 };

    const next = normalizeSelectionAfterBedChange(row, 200, fields, beds);

    expect(next.location_id).toBe(2);
    expect(next.field_id).toBe(20);
    expect(next.bed).toBe(200);
  });
});
