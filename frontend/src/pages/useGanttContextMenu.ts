import { useCallback, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from 'react';
import type { TFunction } from 'i18next';
import { useContextMenuPositionState } from '../components/contextMenu/useContextMenuPositionState';
import { closestContextMenuElement, shouldOpenCustomContextMenu, suppressNativeContextMenu } from '../utils/contextMenu';
import type { GanttTask, GanttTaskGroup } from './ganttChartUtils';
import {
  buildGanttContextMenuActions,
  type GanttContextMenuCallbacks,
  type GanttContextMenuTarget,
} from './ganttContextMenuActions';

/**
 * Encapsulates the Gantt chart's custom context menu: which DOM targets open
 * it, the open/close position state, the task/group open handlers, and the
 * action list for the currently open target (delegated to
 * buildGanttContextMenuActions). Navigation/edit behavior stays in the page and
 * is passed in via `callbacks`.
 */
export function useGanttContextMenu(callbacks: GanttContextMenuCallbacks, t: TFunction) {
  const isGanttContextMenuTarget = useCallback((target: EventTarget | null): boolean => (
    shouldOpenCustomContextMenu(target)
    && closestContextMenuElement(target, '[data-rmg-component="task"], [data-rmg-component="task-group"]') !== null
  ), []);

  const {
    state: contextMenuState,
    open: openContextMenuState,
    close: closeContextMenu,
  } = useContextMenuPositionState<GanttContextMenuTarget>({ isContextMenuTarget: isGanttContextMenuTarget });

  const openContextMenu = useCallback((
    event: ReactMouseEvent | ReactTouchEvent,
    target: GanttContextMenuTarget,
  ) => {
    if (!shouldOpenCustomContextMenu(event.target)) return;
    suppressNativeContextMenu(event);
    const point = 'changedTouches' in event
      ? event.changedTouches[0] ?? event.touches[0]
      : event;
    if (!point) return;
    openContextMenuState(target, point.clientX + 2, point.clientY - 6);
  }, [openContextMenuState]);

  const handleTaskContextMenu = useCallback((
    event: ReactMouseEvent | ReactTouchEvent,
    task: GanttTask,
    group: GanttTaskGroup,
  ) => {
    openContextMenu(event, { type: 'task', task, group });
  }, [openContextMenu]);

  const handleGroupContextMenu = useCallback((
    event: ReactMouseEvent | ReactTouchEvent,
    group: GanttTaskGroup,
  ) => {
    openContextMenu(event, { type: 'group', group });
  }, [openContextMenu]);

  const contextMenuActions = contextMenuState
    ? buildGanttContextMenuActions(contextMenuState.key, callbacks, t)
    : [];

  return {
    contextMenuState,
    closeContextMenu,
    handleTaskContextMenu,
    handleGroupContextMenu,
    contextMenuActions,
  };
}
