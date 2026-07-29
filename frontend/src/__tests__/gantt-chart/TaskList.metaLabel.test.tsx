import React from "react";
import { render, screen } from "@testing-library/react";
import { GanttChart, ViewMode, type TaskGroup } from "../../gantt-chart/src";
import { TREE_INDENT_PX, TREE_META_LABEL_OFFSET_PX } from "../../gantt-chart/src/utils";

const treeRows: TaskGroup[] = [
  {
    id: "location-1",
    name: "Hof",
    depth: 0,
    isExpandable: true,
    isExpanded: true,
    metaLabel: "2 Parzellen · 6 Beete · 5 belegt",
    rowHeightOverride: 40,
    tasks: [],
  },
  {
    id: "field-10",
    name: "Nordfeld",
    depth: 1,
    isExpandable: true,
    isExpanded: true,
    metaLabel: "3 Beete · 2 belegt",
    rowHeightOverride: 40,
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

const renderTree = (tasks: TaskGroup[] = treeRows) =>
  render(<GanttChart tasks={tasks} viewMode={ViewMode.MONTH} viewModes={false} />);

const metaElements = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>('[data-rmg-component="task-group-meta"]'));

describe("TaskList structure meta line", () => {
  test("renders a group's metaLabel as its own line under the row name", () => {
    const { container } = renderTree();

    expect(metaElements(container).map((element) => element.textContent)).toEqual([
      "2 Parzellen · 6 Beete · 5 belegt",
      "3 Beete · 2 belegt",
    ]);
  });

  test("keeps the meta line inside the row it belongs to", () => {
    const { container } = renderTree();

    const [locationMeta] = metaElements(container);
    expect(locationMeta.closest('[data-rmg-component="task-group"]'))
      .toHaveAttribute("data-group-id", "location-1");
  });

  test("indents the meta line to line up with the name at each depth", () => {
    const { container } = renderTree();

    const [locationMeta, fieldMeta] = metaElements(container);
    expect(locationMeta).toHaveStyle({ paddingLeft: `${TREE_META_LABEL_OFFSET_PX}px` });
    expect(fieldMeta).toHaveStyle({
      paddingLeft: `${TREE_INDENT_PX + TREE_META_LABEL_OFFSET_PX}px`,
    });
  });

  test("adds no meta line for rows without a metaLabel", () => {
    const { container } = renderTree();

    const bedRow = container.querySelector('[data-group-id="bed-100"]');
    expect(bedRow?.querySelector('[data-rmg-component="task-group-meta"]')).toBeNull();
  });

  test("ignores a blank metaLabel instead of rendering an empty line", () => {
    const { container } = renderTree([
      { ...treeRows[0], metaLabel: "   " },
      treeRows[2],
    ]);

    expect(metaElements(container)).toHaveLength(0);
  });

  test("renders no meta line for flat (non-tree) groups", () => {
    const { container } = renderTree([
      {
        id: "group-1",
        name: "Beet 1",
        metaLabel: "3 Beete · 2 belegt",
        tasks: [
          {
            id: "task-1",
            name: "Karotte",
            startDate: new Date(2026, 0, 1),
            endDate: new Date(2026, 0, 10),
          },
        ],
      },
    ]);

    expect(metaElements(container)).toHaveLength(0);
  });

  test("keeps the row name rendered next to the meta line", () => {
    renderTree();

    expect(screen.getByText("Hof")).toBeInTheDocument();
    expect(screen.getByText("Nordfeld")).toBeInTheDocument();
  });
});
