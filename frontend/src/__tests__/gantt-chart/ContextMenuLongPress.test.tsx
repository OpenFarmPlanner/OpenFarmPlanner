import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GanttChart, ViewMode, type TaskGroup } from "../../gantt-chart/src";
import { LONG_PRESS_THRESHOLD_MS } from "../../utils/contextMenu";

// Same underlying TaskItem/TaskList components (and long-press behavior) are
// used by both the field occupancy and seedling calendar views, so a single
// suite against the shared gantt-chart library covers both charts.
const currentDate = new Date(2026, 1, 15);

const tasksWithBar: TaskGroup[] = [
  {
    id: "group-1",
    name: "Bed A1",
    tasks: [
      {
        id: "task-1",
        name: "Carrot",
        startDate: new Date(2026, 1, 1),
        endDate: new Date(2026, 1, 20),
      },
    ],
  },
];

const tasksWithTreeRow: TaskGroup[] = [
  {
    id: "group-1",
    name: "Field North",
    depth: 0,
    isExpandable: false,
    tasks: [],
  },
];

describe("Gantt chart context-menu long press (occupancy + seedling views)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("never permanently shows the three-dot context-menu icon on a task bar", () => {
    render(
      <GanttChart
        tasks={tasksWithBar}
        currentDate={currentDate}
        viewMode={ViewMode.MONTH}
        viewModes={false}
        onTaskContextMenu={vi.fn()}
      />,
    );

    const bar = screen.getByTestId("task-task-1");
    const indicator = bar.querySelector('[aria-label="Actions"]');
    expect(indicator).not.toBeNull();
    expect(getComputedStyle(indicator as Element).opacity).toBe("0");
    expect(getComputedStyle(indicator as Element).pointerEvents).toBe("none");
  });

  it("opens the task context menu after a long press", () => {
    const onTaskContextMenu = vi.fn();
    render(
      <GanttChart
        tasks={tasksWithBar}
        currentDate={currentDate}
        viewMode={ViewMode.MONTH}
        viewModes={false}
        onTaskContextMenu={onTaskContextMenu}
      />,
    );
    const bar = screen.getByTestId("task-task-1");

    vi.useFakeTimers();
    fireEvent.touchStart(bar, { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_THRESHOLD_MS);
    });

    expect(onTaskContextMenu).toHaveBeenCalledTimes(1);
  });

  it("does not open the task context menu on a short tap", () => {
    const onTaskContextMenu = vi.fn();
    render(
      <GanttChart
        tasks={tasksWithBar}
        currentDate={currentDate}
        viewMode={ViewMode.MONTH}
        viewModes={false}
        onTaskContextMenu={onTaskContextMenu}
      />,
    );
    const bar = screen.getByTestId("task-task-1");

    vi.useFakeTimers();
    fireEvent.touchStart(bar, { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
    fireEvent.touchEnd(bar);
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_THRESHOLD_MS);
    });

    expect(onTaskContextMenu).not.toHaveBeenCalled();
  });

  it("cancels the task long press when the touch moves (scroll/drag)", () => {
    const onTaskContextMenu = vi.fn();
    render(
      <GanttChart
        tasks={tasksWithBar}
        currentDate={currentDate}
        viewMode={ViewMode.MONTH}
        viewModes={false}
        onTaskContextMenu={onTaskContextMenu}
      />,
    );
    const bar = screen.getByTestId("task-task-1");

    vi.useFakeTimers();
    fireEvent.touchStart(bar, { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
    fireEvent.touchMove(bar, { touches: [{ identifier: 1, clientX: 60, clientY: 60 }] });
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_THRESHOLD_MS);
    });

    expect(onTaskContextMenu).not.toHaveBeenCalled();
  });

  it("suppresses the trailing click after a task bar long press", () => {
    const onTaskContextMenu = vi.fn();
    render(
      <GanttChart
        tasks={tasksWithBar}
        currentDate={currentDate}
        viewMode={ViewMode.MONTH}
        viewModes={false}
        onTaskContextMenu={onTaskContextMenu}
      />,
    );
    const bar = screen.getByTestId("task-task-1");

    vi.useFakeTimers();
    fireEvent.touchStart(bar, { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_THRESHOLD_MS);
    });
    expect(onTaskContextMenu).toHaveBeenCalledTimes(1);

    // A real browser would synthesize a trailing click from this touchend
    // unless its default is prevented — jsdom doesn't perform that
    // synthesis itself, so defaultPrevented is the testable proxy here.
    const touchEndEvent = new TouchEvent("touchend", { bubbles: true, cancelable: true });
    fireEvent(bar, touchEndEvent);

    expect(touchEndEvent.defaultPrevented).toBe(true);
  });

  it("does not suppress the trailing click on a plain short tap of a task bar", () => {
    const onTaskContextMenu = vi.fn();
    render(
      <GanttChart
        tasks={tasksWithBar}
        currentDate={currentDate}
        viewMode={ViewMode.MONTH}
        viewModes={false}
        onTaskContextMenu={onTaskContextMenu}
      />,
    );
    const bar = screen.getByTestId("task-task-1");

    vi.useFakeTimers();
    fireEvent.touchStart(bar, { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
    const touchEndEvent = new TouchEvent("touchend", { bubbles: true, cancelable: true });
    fireEvent(bar, touchEndEvent);

    expect(onTaskContextMenu).not.toHaveBeenCalled();
    expect(touchEndEvent.defaultPrevented).toBe(false);
  });

  it("keeps desktop right-click on a task bar working unchanged", () => {
    const onTaskContextMenu = vi.fn();
    render(
      <GanttChart
        tasks={tasksWithBar}
        currentDate={currentDate}
        viewMode={ViewMode.MONTH}
        viewModes={false}
        onTaskContextMenu={onTaskContextMenu}
      />,
    );
    const bar = screen.getByTestId("task-task-1");

    fireEvent.contextMenu(bar);

    expect(onTaskContextMenu).toHaveBeenCalledTimes(1);
  });

  it("opens the group context menu on a tree row after a long press, and not on a short tap", () => {
    const onGroupContextMenu = vi.fn();
    render(
      <GanttChart
        tasks={tasksWithTreeRow}
        currentDate={currentDate}
        viewMode={ViewMode.MONTH}
        viewModes={false}
        onGroupContextMenu={onGroupContextMenu}
      />,
    );
    const row = screen.getByTestId("task-group-group-1");

    // Short tap: no menu.
    vi.useFakeTimers();
    fireEvent.touchStart(row, { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
    fireEvent.touchEnd(row);
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_THRESHOLD_MS);
    });
    expect(onGroupContextMenu).not.toHaveBeenCalled();

    // Long press: opens the menu.
    fireEvent.touchStart(row, { touches: [{ identifier: 1, clientX: 10, clientY: 10 }] });
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_THRESHOLD_MS);
    });
    expect(onGroupContextMenu).toHaveBeenCalledTimes(1);
  });
});
