import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { MobilePlanFormDialog } from "../components/planting-plans/MobilePlanFormDialog";
import type { MobileCreateFormState } from "../pages/plantingPlansUtils";

const initialForm: MobileCreateFormState = {
  culture: "1",
  bed: "101",
  cultivation_type: "pre_cultivation",
  planting_date: "1.8.2026",
  area_m2: "",
  plants_count: "",
  notes: "",
};

function renderDialog() {
  function Wrapper() {
    const [form, setForm] = useState(initialForm);
    return (
      <MobilePlanFormDialog
        open
        isEdit={false}
        form={form}
        setForm={setForm}
        error=""
        cultureOptions={[{ value: "1", label: "Tomate (Moneymaker)" }]}
        bedOptions={[{ value: "101", label: "Parzelle | Beet" }]}
        cultivationTypeOptions={[{ value: "pre_cultivation", label: "Vorkultur" }]}
        numberLocale="de-DE"
        getPlantsPerSqm={() => null}
        onLinkedFieldEdited={vi.fn()}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
  }

  return render(<Wrapper />);
}

describe("MobilePlanFormDialog", () => {
  it("opens a native picker for planting date and writes selected dates as German text", async () => {
    const user = userEvent.setup();
    renderDialog();

    const pickerInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    const showPicker = vi.fn();
    pickerInput.showPicker = showPicker;

    await user.click(screen.getByRole("button", { name: "Kalender öffnen" }));
    expect(showPicker).toHaveBeenCalledTimes(1);

    fireEvent.change(pickerInput, { target: { value: "2026-08-05" } });
    expect(screen.getByRole("textbox", { name: "Pflanzdatum" })).toHaveValue("05.08.2026");
  });
});
