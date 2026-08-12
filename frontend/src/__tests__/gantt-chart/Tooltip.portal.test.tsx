import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GanttChart, type TaskGroup } from "../../gantt-chart/src";
import { registerOpenContextMenu } from "../../components/contextMenu/contextMenuOpenState";

const tasks: TaskGroup[] = [
  {
    id: "group-1",
    name: "Engineering",
    tasks: [
      {
        id: "task-1",
        name: "Portal Task",
        startDate: new Date(2026, 1, 1),
        endDate: new Date(2026, 1, 10),
        percent: 55,
      },
    ],
  },
];

const taskRect = {
  left: 100,
  top: 100,
  width: 140,
  height: 32,
  right: 240,
  bottom: 132,
};
let currentTaskRect = { ...taskRect };

const setViewport = (width: number, height: number) => {
  Object.defineProperty(window, "innerWidth", {
    value: width,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, "innerHeight", {
    value: height,
    configurable: true,
    writable: true,
  });
};

describe("Tooltip portal behavior", () => {
  beforeEach(() => {
    currentTaskRect = { ...taskRect };
    setViewport(1200, 800);

    vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this.dataset.taskId === "task-1") {
          return {
            ...currentTaskRect,
            x: currentTaskRect.left,
            y: currentTaskRect.top,
            toJSON() {},
          } as DOMRect;
        }

        if (this.dataset.rmgComponent === "tooltip") {
          return {
            left: 0,
            top: 0,
            width: 220,
            height: 90,
            right: 220,
            bottom: 90,
            x: 0,
            y: 0,
            toJSON() {},
          } as DOMRect;
        }

        return {
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          right: 0,
          bottom: 0,
          x: 0,
          y: 0,
          toJSON() {},
        } as DOMRect;
      });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("renders tooltip through a portal into document.body by default", async () => {
    render(
      <div style={{ overflow: "hidden", maxHeight: 120 }}>
        <GanttChart tasks={tasks} />
      </div>,
    );

    fireEvent.mouseEnter(screen.getByTestId("task-task-1"), {
      clientX: 120,
      clientY: 120,
    });

    const tooltipRoot = await waitFor(() => {
      const node = document.body.querySelector(
        '[data-rmg-component="tooltip"]',
      ) as HTMLElement | null;
      expect(node).not.toBeNull();
      return node!;
    });

    expect(tooltipRoot).toBeInTheDocument();
    expect(tooltipRoot?.parentElement).toBe(document.body);
    expect(tooltipRoot).toHaveStyle({ position: "fixed" });
  });

  test("can render inline when portal behavior is disabled", async () => {
    render(<GanttChart tasks={tasks} renderTooltipInPortal={false} />);

    fireEvent.mouseEnter(screen.getByTestId("task-task-1"), {
      clientX: 120,
      clientY: 120,
    });

    const tooltipRoot = await waitFor(() => {
      const node = document.querySelector(
        '[data-rmg-component="tooltip"]',
      ) as HTMLElement | null;
      expect(node).not.toBeNull();
      return node!;
    });

    expect(tooltipRoot.parentElement).not.toBe(document.body);
    expect(tooltipRoot).not.toHaveStyle({ position: "fixed" });
  });

  test("flips above when there is not enough space below", async () => {
    setViewport(1200, 210);
    currentTaskRect = {
      left: 100,
      top: 150,
      width: 140,
      height: 32,
      right: 240,
      bottom: 182,
    };

    render(<GanttChart tasks={tasks} tooltipOffset={10} />);

    fireEvent.mouseEnter(screen.getByTestId("task-task-1"), {
      clientX: 140,
      clientY: 165,
    });

    await waitFor(() => {
      const node = document.body.querySelector(
        '[data-rmg-component="tooltip"]',
      ) as HTMLElement | null;
      expect(node).not.toBeNull();
      expect(node).toHaveAttribute("data-placement", "top");
      expect(parseFloat(node!.style.top)).toBeLessThan(currentTaskRect.top);
    });
  });

  test("updates tooltip position on scroll and resize", async () => {
    render(<GanttChart tasks={tasks} />);

    fireEvent.mouseEnter(screen.getByTestId("task-task-1"), {
      clientX: 120,
      clientY: 120,
    });

    const tooltipRoot = await waitFor(() => {
      const node = document.body.querySelector(
        '[data-rmg-component="tooltip"]',
      ) as HTMLElement | null;
      expect(node).not.toBeNull();
      return node!;
    });

    const firstTop = tooltipRoot.style.top;
    currentTaskRect = {
      left: 200,
      top: 40,
      width: 140,
      height: 32,
      right: 340,
      bottom: 72,
    };

    fireEvent.scroll(window);
    fireEvent(window, new Event("resize"));

    await waitFor(() => {
      expect(tooltipRoot.style.top).not.toBe(firstTop);
      expect(tooltipRoot.style.left).toBe("160px");
    });
  });

  test("hides the task tooltip while a context menu is open", async () => {
    render(<GanttChart tasks={tasks} />);

    fireEvent.mouseEnter(screen.getByTestId("task-task-1"), {
      clientX: 120,
      clientY: 120,
    });

    await waitFor(() => {
      expect(
        document.body.querySelector('[data-rmg-component="tooltip"]'),
      ).not.toBeNull();
    });

    const release = registerOpenContextMenu(Symbol("gantt-context-menu"));
    try {
      await waitFor(() => {
        expect(
          document.body.querySelector('[data-rmg-component="tooltip"]'),
        ).toBeNull();
      });
    } finally {
      release();
    }

    // The tooltip comes back once the menu is gone - the pointer never left.
    await waitFor(() => {
      expect(
        document.body.querySelector('[data-rmg-component="tooltip"]'),
      ).not.toBeNull();
    });
  });

  test("keeps custom renderTooltip content working with portal rendering", async () => {
    render(
      <GanttChart
        tasks={tasks}
        renderTooltip={({ task, startDate }) => (
          <div>
            {task.name} / {startDate.getFullYear()}
          </div>
        )}
      />,
    );

    fireEvent.mouseEnter(screen.getByTestId("task-task-1"), {
      clientX: 120,
      clientY: 120,
    });

    expect(await screen.findByText("Portal Task / 2026")).toBeInTheDocument();
  });
});
