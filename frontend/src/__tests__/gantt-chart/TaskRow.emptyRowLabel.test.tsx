import React from "react";
import { render, screen } from "@testing-library/react";
import { GanttChart, ViewMode, type TaskGroup } from "../../gantt-chart/src";

const COMPACT_ROW_HEIGHT = 32;

const treeRows: TaskGroup[] = [
  {
    id: "location-1",
    name: "Hof",
    depth: 0,
    isExpandable: true,
    isExpanded: true,
    emptyRowLabel: "2 Parzellen · 6 Beete · 5 belegt",
    rowHeightOverride: COMPACT_ROW_HEIGHT,
    tasks: [],
  },
  {
    id: "field-10",
    name: "Nordfeld",
    depth: 1,
    isExpandable: true,
    isExpanded: true,
    emptyRowLabel: "3 Beete · 2 belegt",
    rowHeightOverride: COMPACT_ROW_HEIGHT,
    tasks: [],
  },
  {
    id: "bed-100",
    name: "Beet 1",
    depth: 2,
    tasks: [
      {
        id: "task-1",
        name: "Karotte",
        startDate: new Date(2026, 0, 1),
        endDate: new Date(2026, 0, 10),
      },
    ],
  },
];

const renderTree = (tasks: TaskGroup[] = treeRows, viewMode: ViewMode = ViewMode.MONTH) =>
  render(<GanttChart tasks={tasks} viewMode={viewMode} viewModes={false} />);

const summaryElements = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll<HTMLElement>('[data-rmg-component="task-row-empty-label"]'),
  );

describe("TaskRow structure summary", () => {
  test("renders a group's emptyRowLabel once, in the timeline area", () => {
    const { container } = renderTree();

    expect(summaryElements(container).map((element) => element.textContent)).toEqual([
      "2 Parzellen · 6 Beete · 5 belegt",
      "3 Beete · 2 belegt",
    ]);
  });

  test("keeps the summary out of the left column, which shows only chevron and name", () => {
    const { container } = renderTree();

    const taskList = container.querySelector<HTMLElement>(".rmg-task-list");
    expect(taskList).not.toBeNull();
    expect(taskList?.textContent).not.toContain("Beete");
    expect(taskList?.querySelectorAll('[data-rmg-component="task-row-empty-label"]')).toHaveLength(0);

    const locationRow = container.querySelector<HTMLElement>(
      '[data-rmg-component="task-group"][data-group-id="location-1"]',
    );
    expect(locationRow?.querySelector('[data-rmg-component="task-group-chevron"]')).not.toBeNull();
    expect(locationRow?.querySelector('[data-rmg-component="task-group-name"]')?.textContent).toBe("Hof");
    expect(locationRow?.textContent).toBe("Hof");
  });

  test("anchors the summary in the timeline row of the group it belongs to", () => {
    const { container } = renderTree();

    const [locationSummary] = summaryElements(container);
    expect(locationSummary.closest("[data-group-id]")).toHaveAttribute("data-group-id", "location-1");
    expect(locationSummary.closest(".rmg-timeline-container")).not.toBeNull();
    expect(locationSummary.closest(".rmg-task-list")).toBeNull();
  });

  test("does not render the summary twice", () => {
    const { container } = renderTree();

    expect(screen.getAllByText("2 Parzellen · 6 Beete · 5 belegt")).toHaveLength(1);
    expect(
      container.querySelectorAll('[data-group-id="location-1"] [data-rmg-component="task-row-empty-label"]'),
    ).toHaveLength(1);
  });

  test("leaves the row height untouched by the summary", () => {
    const { container } = renderTree();

    const locationRow = summaryElements(container)[0].closest<HTMLElement>(".rmg-task-row");
    expect(locationRow).toHaveStyle({ minHeight: `${COMPACT_ROW_HEIGHT}px` });
    // The row's own height comes from `minHeight` alone; the label is a single
    // nowrap line styled by `.rmg-task-row-empty-label`, which keeps it well
    // under that and so never pushes the timeline row past the sidebar row.
    expect(summaryElements(container)[0]).toHaveClass("rmg-task-row-empty-label");
  });

  test("publishes the left column width so the summary can pin to the divider", () => {
    const { container } = render(
      <GanttChart
        tasks={treeRows}
        viewMode={ViewMode.MONTH}
        viewModes={false}
        leftColumnWidth={240}
      />,
    );

    // `.rmg-task-row-empty-label` sticks at this offset, so it stays just past
    // the border of the sticky left column while the timeline scrolls.
    expect(container.querySelector<HTMLElement>(".rmg-gantt-chart")?.style
      .getPropertyValue("--rmg-left-column-width")).toBe("240px");
  });

  test("adds no summary to rows that have bars", () => {
    const { container } = renderTree();

    const bedRow = container.querySelector('.rmg-timeline-container [data-group-id="bed-100"]');
    expect(bedRow?.querySelector('[data-rmg-component="task-row-empty-label"]')).toBeNull();
  });

  test("ignores a blank emptyRowLabel instead of rendering an empty summary", () => {
    const { container } = renderTree([{ ...treeRows[0], emptyRowLabel: "   " }, treeRows[2]]);

    expect(summaryElements(container)).toHaveLength(0);
  });

  test.each([
    ViewMode.DAY,
    ViewMode.WEEK,
    ViewMode.MONTH,
    ViewMode.QUARTER,
    ViewMode.YEAR,
  ])("renders the summary in %s zoom level", (viewMode) => {
    const { container } = renderTree(treeRows, viewMode);

    expect(summaryElements(container).map((element) => element.textContent)).toEqual([
      "2 Parzellen · 6 Beete · 5 belegt",
      "3 Beete · 2 belegt",
    ]);
  });

  test("keeps the summary when a level is collapsed", () => {
    const collapsed: TaskGroup[] = [
      { ...treeRows[0], isExpanded: false },
    ];
    const { container } = renderTree(collapsed);

    expect(summaryElements(container).map((element) => element.textContent)).toEqual([
      "2 Parzellen · 6 Beete · 5 belegt",
    ]);
    expect(summaryElements(container)[0].closest("[data-group-id]")).toHaveAttribute(
      "data-group-id",
      "location-1",
    );
  });
});
