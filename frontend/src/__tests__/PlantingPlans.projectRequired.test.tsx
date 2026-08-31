import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlantingPlans from "../pages/PlantingPlans";
import type { RootLayoutOutletContext } from "../navigation/topbarTypes";

const apiMocks = vi.hoisted(() => ({
  cultureList: vi.fn(),
  locationList: vi.fn(),
  fieldList: vi.fn(),
  bedList: vi.fn(),
  planList: vi.fn(),
}));

const projectRequirementState = vi.hoisted(() => ({
  shouldShowProjectRequiredState: false,
  missingProjectReason: null as null | "no_projects" | "no_active_project",
}));

vi.mock("../hooks/useProjectRequirement", () => ({
  useProjectRequirement: () => projectRequirementState,
}));

vi.mock("../commands/useCommandContext", () => ({
  useCommandContextTag: vi.fn(),
  useRegisterCommands: vi.fn(),
  useRegisterCreateActions: vi.fn(),
}));
vi.mock("../hooks/useNavigationBlocker", () => ({
  useNavigationBlocker: () => ({
    isBlocked: false,
    proceed: vi.fn(),
    reset: vi.fn(),
    destination: null,
  }),
}));

vi.mock("../api/api", async () => {
  const actual = await vi.importActual<typeof import("../api/api")>("../api/api");
  return {
    ...actual,
    cultureAPI: {
      ...actual.cultureAPI,
      list: apiMocks.cultureList,
      listAll: async () => (await apiMocks.cultureList()).data,
    },
    locationAPI: {
      ...actual.locationAPI,
      list: apiMocks.locationList,
      listAll: async () => (await apiMocks.locationList()).data,
    },
    fieldAPI: {
      ...actual.fieldAPI,
      list: apiMocks.fieldList,
      listAll: async () => (await apiMocks.fieldList()).data,
    },
    bedAPI: {
      ...actual.bedAPI,
      list: apiMocks.bedList,
      listAll: async () => (await apiMocks.bedList()).data,
    },
    plantingPlanAPI: {
      ...actual.plantingPlanAPI,
      list: apiMocks.planList,
      listAll: async () => (await apiMocks.planList()).data,
    },
  };
});

describe("PlantingPlans project requirement state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectRequirementState.shouldShowProjectRequiredState = false;
    projectRequirementState.missingProjectReason = null;
    apiMocks.cultureList.mockResolvedValue({ data: { results: [] } });
    apiMocks.locationList.mockResolvedValue({ data: { results: [] } });
    apiMocks.fieldList.mockResolvedValue({ data: { results: [] } });
    apiMocks.bedList.mockResolvedValue({ data: { results: [] } });
    apiMocks.planList.mockResolvedValue({ data: { results: [] } });
  });

  function renderWithOutletContext(context: Partial<RootLayoutOutletContext>) {
    const outletContext = {
      setTopbarContextActions: vi.fn(),
      setTopbarTitleActions: vi.fn(),
      activeSeasonYear: null,
      activeSeason: null,
      activeSeasonLoading: false,
      activeSeasonLoaded: true,
      hasSeasons: false,
      requestSeasonCreation: vi.fn(),
      notifications: {} as RootLayoutOutletContext["notifications"],
      ...context,
    } satisfies RootLayoutOutletContext;

    return {
      outletContext,
      ...render(
        <MemoryRouter initialEntries={["/app/anbauplaene"]}>
          <Routes>
            <Route element={<Outlet context={outletContext} />}>
              <Route path="/app/anbauplaene" element={<PlantingPlans />} />
            </Route>
          </Routes>
        </MemoryRouter>,
      ),
    };
  }

  it("shows friendly no-project state and skips project-bound loading", async () => {
    projectRequirementState.shouldShowProjectRequiredState = true;
    projectRequirementState.missingProjectReason = "no_projects";

    render(
      <MemoryRouter>
        <PlantingPlans />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Du hast noch kein Projekt.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Erstes Projekt anlegen" })).toBeInTheDocument();
    expect(apiMocks.cultureList).not.toHaveBeenCalled();
    expect(apiMocks.bedList).not.toHaveBeenCalled();
  });

  it("shows the field setup entry when no locations exist", async () => {
    render(
      <MemoryRouter>
        <PlantingPlans />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Du kannst noch keinen Anbauplan hinzufügen.")).toBeInTheDocument();
    expect(screen.getByText("Öffne die Anbauflächen und füge dort eine Parzelle beim passenden Standort hinzu.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Parzelle hinzufügen" })).toHaveAttribute(
      "href",
      "/app/fields-beds?action=add-parcel",
    );
    expect(screen.queryByRole("link", { name: "Standort hinzufügen" })).not.toBeInTheDocument();
    expect(screen.queryByText("Kultur fehlt")).not.toBeInTheDocument();
    expect(screen.queryByText("Beet fehlt")).not.toBeInTheDocument();
  });

  it("opens the fields-beds page when a location exists but no fields exist", async () => {
    apiMocks.locationList.mockResolvedValue({ data: { results: [{ id: 1, name: "Hof" }] } });

    render(
      <MemoryRouter>
        <PlantingPlans />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Öffne die Anbauflächen und füge dort eine Parzelle beim passenden Standort hinzu.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Parzelle hinzufügen" })).toHaveAttribute(
      "href",
      "/app/fields-beds?action=add-parcel",
    );
    expect(screen.queryByRole("link", { name: "Zu Anbauflächen" })).not.toBeInTheDocument();
  });

  it("shows the culture library as the primary action when cultures are missing", async () => {
    apiMocks.locationList.mockResolvedValue({ data: { results: [{ id: 1, name: "Hof" }] } });
    apiMocks.fieldList.mockResolvedValue({ data: { results: [{ id: 2, name: "Nord", location: 1 }] } });
    apiMocks.bedList.mockResolvedValue({ data: { results: [{ id: 3, name: "Beet A", field: 2 }] } });

    render(
      <MemoryRouter>
        <PlantingPlans />
      </MemoryRouter>,
    );

    const libraryLink = await screen.findByRole("link", { name: "Kulturbibliothek öffnen" });
    const createCultureLink = screen.getByRole("link", { name: "Kultur hinzufügen" });

    expect(libraryLink).toHaveAttribute("href", "/app/cultures?library=true");
    expect(libraryLink.className).toContain("MuiButton-contained");
    expect(createCultureLink).toHaveAttribute("href", "/app/cultures?create=true");
    expect(createCultureLink.className).toContain("MuiButton-outlined");
  });

  it("uses the create handler from the no-plans empty state", async () => {
    apiMocks.locationList.mockResolvedValue({ data: { results: [{ id: 1, name: "Hof" }] } });
    apiMocks.fieldList.mockResolvedValue({ data: { results: [{ id: 2, name: "Nord", location: 1 }] } });
    apiMocks.bedList.mockResolvedValue({ data: { results: [{ id: 3, name: "Beet A", field: 2 }] } });
    apiMocks.cultureList.mockResolvedValue({ data: { results: [{ id: 4, name: "Tomate" }] } });

    const { container } = render(
      <MemoryRouter initialEntries={["/app/anbauplaene"]}>
        <PlantingPlans />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Du hast noch keinen Anbauplan erstellt.")).toBeInTheDocument();

    const createButton = screen.getByRole("button", { name: "Anbauplan hinzufügen" });
    expect(screen.queryByRole("link", { name: "Anbauplan hinzufügen" })).not.toBeInTheDocument();

    fireEvent.click(createButton);

    await waitFor(() => {
      expect(container.querySelector(".MuiDataGrid-row--editing")).toBeInTheDocument();
    });
  });

  it("requires a season before a planting plan can be created", async () => {
    apiMocks.locationList.mockResolvedValue({ data: { results: [{ id: 1, name: "Hof" }] } });
    apiMocks.fieldList.mockResolvedValue({ data: { results: [{ id: 2, name: "Nord", location: 1 }] } });
    apiMocks.bedList.mockResolvedValue({ data: { results: [{ id: 3, name: "Beet A", field: 2 }] } });
    apiMocks.cultureList.mockResolvedValue({ data: { results: [{ id: 4, name: "Tomate" }] } });
    const requestSeasonCreation = vi.fn();

    const { container } = renderWithOutletContext({ requestSeasonCreation });

    expect(await screen.findByText("Noch keine Saison angelegt")).toBeInTheDocument();
    const seasonButton = screen.getByRole("button", { name: "Saison anlegen" });
    // The season empty state offers only the "create season" action — no
    // separate disabled "add planting plan" button.
    expect(screen.queryByRole("button", { name: "Anbauplan hinzufügen" })).not.toBeInTheDocument();
    expect(container.querySelector(".MuiDataGrid-row--editing")).not.toBeInTheDocument();

    fireEvent.click(seasonButton);
    expect(requestSeasonCreation).toHaveBeenCalledTimes(1);
  });
});
