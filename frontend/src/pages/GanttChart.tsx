/**
 * Gantt Chart page component for visualizing bed occupation and seedling propagation.
 *
 * Displays a timeline view of planting plans grouped either by beds or by cultures.
 * UI text is in German, while code comments remain in English.
 *
 * @returns The Gantt Chart page component
 */

import React, { useState, useEffect, useMemo, useCallback, useContext, useRef, useLayoutEffect } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { useTranslation } from '../i18n';
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Divider,
  MenuItem,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { TypeaheadSelect as Select } from '../components/inputs/TypeaheadSelect';
import {
  bedAPI,
  cultureAPI,
  fieldAPI,
  locationAPI,
  plantingPlanAPI,
  type Bed,
  type Culture,
  type Field,
  type Location,
  type PlantingPlan,
} from '../api/api';
import GanttChart, { ViewMode } from '../gantt-chart/src';
import './GanttChart.css';
import { useCommandContextTag, useRegisterCommands } from '../commands/useCommandContext';
import PageContainer from '../components/layout/PageContainer';
import PageSurface from '../components/layout/PageSurface';
import ProjectRequiredState from '../components/project/ProjectRequiredState';
import type { CommandSpec } from '../commands/types';
import { useProjectRequirement } from '../hooks/useProjectRequirement';
import { extractApiErrorMessage } from '../api/errors';
import { useTopbarContextActions } from '../hooks/useTopbarContextActions';
import { useTopbarTitleActions } from '../hooks/useTopbarTitleActions';
import { CustomContextMenu } from '../components/contextMenu/CustomContextMenu';
import EmptyStateCard from '../components/project/EmptyStateCard';
import type { RootLayoutOutletContext, TopbarContextAction } from '../navigation/topbarTypes';
import { AuthContext } from '../auth/authContextShared';
import {
  CALENDAR_SHORTCUT_VIEW_MODES,
  type CalendarMode,
  DEFAULT_TIMELINE_VIEW_MODE,
  GANTT_HEADER_VIEW_MODES,
  GANTT_LEFT_COLUMN_DESKTOP_DEFAULT_WIDTH,
  GANTT_LEFT_COLUMN_DESKTOP_MAX_WIDTH,
  GANTT_LEFT_COLUMN_DESKTOP_MIN_WIDTH,
  GANTT_LEFT_COLUMN_MOBILE_DEFAULT_WIDTH,
  GANTT_LEFT_COLUMN_MOBILE_MAX_WIDTH,
  GANTT_LEFT_COLUMN_MOBILE_MIN_WIDTH,
  GANTT_ROW_HEIGHT,
  GANTT_SIDEBAR_RESIZE_HANDLE_DESKTOP_HITBOX_WIDTH,
  GANTT_SIDEBAR_RESIZE_HANDLE_MOBILE_HITBOX_WIDTH,
  GANTT_SIDEBAR_RESIZE_KEYBOARD_STEP,
  GANTT_VIEWPORT_BOTTOM_MARGIN_PX,
  GANTT_VIEWPORT_MIN_HEIGHT_PX,
  OCCUPANCY_COMPACT_ROW_HEIGHT,
  type SyntheticMousePoint,
  addTimelinePeriod,
  addTimelinePeriodLarge,
  clampDate,
  clampGanttLeftColumnWidth,
  dispatchSyntheticMouseEvent,
  formatDateToAPI,
  getCalendarGanttRowHeight,
  getCalendarModeFromViewParam,
  getCalendarViewStorageKey,
  getGanttStateStorageKey,
  getInitialTimelineReferenceDate,
  getPrimaryTouch,
  getReferenceDateFromScroll,
  getStoredCalendarMode,
  getStoredGanttState,
  getStoredTimelineViewModeFromState,
  getTimelineScrollLeftForDate,
  getTimelineViewModeStorageKey,
  getViewParamFromCalendarMode,
  isCalendarViewParam,
  storeCalendarMode,
  storeGanttState,
  storeTimelineViewMode,
  toSyntheticMousePoint,
} from './ganttChartState';
import {
  buildOccupancyTooltipDetails,
  buildSeedlingTaskGroups,
  buildSeedlingTooltipDetails,
  formatSeedlingTooltipTitle,
  formatPlantCount,
  parseDateString,
  type GanttTask,
  type GanttTaskGroup,
  type OccupancyHierarchyNode,
} from './ganttChartUtils';
import {
  buildOccupancyStructureSummaries,
  formatOccupancyStructureSummary,
} from './occupancyStructureSummary';
import { useGanttContextMenu } from './useGanttContextMenu';
import { useGanttTaskActions } from './useGanttTaskActions';
import { useOccupancyHierarchyFilter } from './useOccupancyHierarchyFilter';
import { getFirstMissingCultivationPlanRequirement, getTranslatedProjectSetupActions } from './requirementFlow';
import {
  getSegmentedActionButtonSx,
  segmentedButtonGroupSx,
} from '../components/buttons/segmentedControlStyles';
import { getGanttRenderWindow } from './ganttRenderWindow';
import { collectVisibleIdsWithAncestors, flattenTreeRows } from '../components/hierarchy/utils/treeRows';
import { HierarchyLevelButtons } from '../components/hierarchy/HierarchyLevelToggle';
import { CalendarFiltersPopover } from '../components/gantt/CalendarFiltersPopover';
import { OccupancyFilterRow } from '../components/gantt/OccupancyFilterRow';
import { SeedlingFilters } from '../components/gantt/SeedlingFilters';
import { OccupancyMobileFilterBar } from '../components/gantt/OccupancyMobileFilterBar';
import { AppTooltip } from '../components/AppTooltip';

const GanttChartWithFocusMode = GanttChart as React.ComponentType<
  React.ComponentProps<typeof GanttChart> & { focusMode?: boolean }
>;




class GanttRenderBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.error('Gantt render failed', error);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}


function GanttChartPage() {
  const { t, i18n } = useTranslation(['ganttChart', 'common']);
  const theme = useTheme();
  const useMobileFilterLayout = useMediaQuery(theme.breakpoints.down('md'));
  // Narrower than useMobileFilterLayout on purpose: the level-toggle buttons
  // embedded in the "Anbauflächen" header should still show on tablets, only
  // hidden on phone-sized viewports where there isn't room for them.
  const isPhoneViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const authContext = useContext(AuthContext);
  const activeProjectId = authContext?.activeProjectId ?? null;
  const isAuthLoading = authContext?.isLoading ?? false;
  const canUseStoredCalendarView = Boolean(authContext);
  const { shouldShowProjectRequiredState, missingProjectReason } = useProjectRequirement();
  useCommandContextTag('calendar');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [locations, setLocations] = useState<Location[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [plantingPlans, setPlantingPlans] = useState<PlantingPlan[]>([]);
  const [cultures, setCultures] = useState<Culture[]>([]);

  // Standort/Parzelle/Beet tree: filter + search state for the occupancy view
  const [occupancySearchText, setOccupancySearchText] = useState('');

  // Seedling (Anzucht) view: search-only, no hierarchy/location filters —
  // it's a flat, culture-grouped list, not tied to a specific bed/field.
  const [seedlingSearchText, setSeedlingSearchText] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [calendarFilterAnchorEl, setCalendarFilterAnchorEl] = useState<HTMLElement | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const focusSearch = useCallback(() => {
    if (useMobileFilterLayout) {
      setMobileSearchOpen(true);
    }
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, [useMobileFilterLayout]);
  useEffect(() => {
    if (!mobileSearchOpen) {
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mobileSearchOpen]);


  const [ganttRenderKey, setGanttRenderKey] = useState(0);
  const [ganttScrollTop, setGanttScrollTop] = useState(0);
  const [ganttViewportHeight, setGanttViewportHeight] = useState(640);
  const [ganttMaxHeightPx, setGanttMaxHeightPx] = useState<number | null>(null);
  const ganttViewportRef = useRef<HTMLDivElement | null>(null);
  const [ganttResizeBoundaryNode, setGanttResizeBoundaryNode] = useState<HTMLDivElement | null>(null);
  const ganttSidebarWidthFrameRef = useRef<number | null>(null);
  const hasRestoredTimelineRef = useRef(false);
  const latestReferenceDateRef = useRef<Date | null>(null);
  const currentYear = new Date().getFullYear();
  const [displayYear] = useState(currentYear);
  const startDate = useMemo(() => new Date(displayYear, 0, 1), [displayYear]);
  const endDate = useMemo(() => new Date(displayYear, 11, 31), [displayYear]);

  const {
    occupancyHierarchyNodes,
    occupancyLocationFilter,
    setOccupancyLocationFilter,
    occupancyFieldFilter,
    setOccupancyFieldFilter,
    onlyOccupiedBeds,
    setOnlyOccupiedBeds,
    occupancyFieldOptions,
    activeHierarchyFilterCount,
    resetOccupancyHierarchyFilters,
    expandedHierarchyIds,
    toggleHierarchyExpand,
    hierarchyLevelToggle,
  } = useOccupancyHierarchyFilter({
    locations,
    fields,
    beds,
    plantingPlans,
    cultures,
    displayYear,
    activeProjectId,
  });

  const ganttStateStorageKey = useMemo(
    () => (canUseStoredCalendarView ? getGanttStateStorageKey(activeProjectId) : null),
    [activeProjectId, canUseStoredCalendarView],
  );
  const storedGanttState = useMemo(
    () => getStoredGanttState(ganttStateStorageKey),
    [ganttStateStorageKey],
  );
  const [ganttLeftColumnWidthDesktop, setGanttLeftColumnWidthDesktop] = useState(
    storedGanttState?.leftColumnWidthDesktop
      ?? storedGanttState?.leftColumnWidth
      ?? GANTT_LEFT_COLUMN_DESKTOP_DEFAULT_WIDTH,
  );
  const [ganttLeftColumnWidthMobile, setGanttLeftColumnWidthMobile] = useState(
    storedGanttState?.leftColumnWidthMobile ?? GANTT_LEFT_COLUMN_MOBILE_DEFAULT_WIDTH,
  );
  const [isResizingGanttSidebar, setIsResizingGanttSidebar] = useState(false);
  const [ganttResizeHandleTop, setGanttResizeHandleTop] = useState<number | null>(null);
  const calendarViewStorageKey = useMemo(
    () => (canUseStoredCalendarView ? getCalendarViewStorageKey(activeProjectId) : null),
    [activeProjectId, canUseStoredCalendarView],
  );
  const timelineViewModeStorageKey = useMemo(
    () => (canUseStoredCalendarView ? getTimelineViewModeStorageKey(activeProjectId) : null),
    [activeProjectId, canUseStoredCalendarView],
  );
  const [calendarMode, setCalendarMode] = useState<CalendarMode>(() => {
    const viewParam = searchParams.get('view');
    return isCalendarViewParam(viewParam)
      ? getCalendarModeFromViewParam(viewParam)
      : storedGanttState?.calendarMode
        ? storedGanttState.calendarMode
      : calendarViewStorageKey
        ? getStoredCalendarMode(calendarViewStorageKey) ?? 'occupancy'
        : 'occupancy';
  });
  const [timelineViewMode, setTimelineViewMode] = useState<ViewMode>(() => (
    getStoredTimelineViewModeFromState(storedGanttState) ?? DEFAULT_TIMELINE_VIEW_MODE
  ));
  const activeGanttLeftColumnWidth = useMobileFilterLayout
    ? ganttLeftColumnWidthMobile
    : ganttLeftColumnWidthDesktop;
  const activeGanttLeftColumnMinWidth = useMobileFilterLayout
    ? GANTT_LEFT_COLUMN_MOBILE_MIN_WIDTH
    : GANTT_LEFT_COLUMN_DESKTOP_MIN_WIDTH;
  const activeGanttLeftColumnMaxWidth = useMobileFilterLayout
    ? GANTT_LEFT_COLUMN_MOBILE_MAX_WIDTH
    : GANTT_LEFT_COLUMN_DESKTOP_MAX_WIDTH;
  const ganttSidebarResizeHandleHitboxWidth = useMobileFilterLayout
    ? GANTT_SIDEBAR_RESIZE_HANDLE_MOBILE_HITBOX_WIDTH
    : GANTT_SIDEBAR_RESIZE_HANDLE_DESKTOP_HITBOX_WIDTH;
  const useWindowedGanttRows = !useMobileFilterLayout;
  const activeGanttLeftColumnWidthRef = useRef(activeGanttLeftColumnWidth);
  const handleGanttResizeBoundaryRef = useCallback((node: HTMLDivElement | null): void => {
    setGanttResizeBoundaryNode(node);
  }, []);
  const [editMode, setEditMode] = useState(false);
  const outletContext = useOutletContext<RootLayoutOutletContext | null>();
  const setTopbarContextActions = outletContext?.setTopbarContextActions;
  const setTopbarTitleActions = outletContext?.setTopbarTitleActions;

  useEffect(() => {
    setGanttLeftColumnWidthDesktop(
      storedGanttState?.leftColumnWidthDesktop
        ?? storedGanttState?.leftColumnWidth
        ?? GANTT_LEFT_COLUMN_DESKTOP_DEFAULT_WIDTH,
    );
    setGanttLeftColumnWidthMobile(
      storedGanttState?.leftColumnWidthMobile ?? GANTT_LEFT_COLUMN_MOBILE_DEFAULT_WIDTH,
    );
  }, [
    ganttStateStorageKey,
    storedGanttState?.leftColumnWidth,
    storedGanttState?.leftColumnWidthDesktop,
    storedGanttState?.leftColumnWidthMobile,
  ]);

  useEffect(() => () => {
    if (ganttSidebarWidthFrameRef.current !== null) {
      window.cancelAnimationFrame(ganttSidebarWidthFrameRef.current);
    }
  }, []);

  useEffect(() => {
    activeGanttLeftColumnWidthRef.current = activeGanttLeftColumnWidth;
  }, [activeGanttLeftColumnWidth]);

  useEffect(() => {
    const viewParam = searchParams.get('view');
    if (!isCalendarViewParam(viewParam) && isAuthLoading) {
      return;
    }

    const nextMode = isCalendarViewParam(viewParam)
      ? getCalendarModeFromViewParam(viewParam)
      : storedGanttState?.calendarMode
        ? storedGanttState.calendarMode
      : calendarViewStorageKey
        ? getStoredCalendarMode(calendarViewStorageKey) ?? 'occupancy'
        : 'occupancy';

    setCalendarMode((currentMode) => (currentMode === nextMode ? currentMode : nextMode));

    if (isCalendarViewParam(viewParam)) {
      if (calendarViewStorageKey) {
        storeCalendarMode(calendarViewStorageKey, nextMode);
      }
      storeGanttState(ganttStateStorageKey, { calendarMode: nextMode });
      return;
    }

    setSearchParams((currentSearchParams) => {
      const nextSearchParams = new URLSearchParams(currentSearchParams);
      nextSearchParams.set('view', getViewParamFromCalendarMode(nextMode));
      return nextSearchParams;
    }, { replace: true });
  }, [calendarViewStorageKey, ganttStateStorageKey, isAuthLoading, searchParams, setSearchParams, storedGanttState?.calendarMode]);

  useEffect(() => {
    if (!timelineViewModeStorageKey || isAuthLoading) {
      return;
    }

    const nextViewMode = getStoredTimelineViewModeFromState(storedGanttState) ?? DEFAULT_TIMELINE_VIEW_MODE;
    setTimelineViewMode((currentViewMode) => (currentViewMode === nextViewMode ? currentViewMode : nextViewMode));
  }, [isAuthLoading, storedGanttState, timelineViewModeStorageKey]);

  const handleCalendarModeChange = useCallback((nextMode: CalendarMode) => {
    setCalendarMode(nextMode);
    if (calendarViewStorageKey) {
      storeCalendarMode(calendarViewStorageKey, nextMode);
    }
    storeGanttState(ganttStateStorageKey, { calendarMode: nextMode });
    setSearchParams((currentSearchParams) => {
      if (currentSearchParams.get('view') === getViewParamFromCalendarMode(nextMode)) {
        return currentSearchParams;
      }
      const nextSearchParams = new URLSearchParams(currentSearchParams);
      nextSearchParams.set('view', getViewParamFromCalendarMode(nextMode));
      return nextSearchParams;
    });
  }, [calendarViewStorageKey, ganttStateStorageKey, setSearchParams]);

  const handleTimelineViewModeChange = useCallback((
    nextViewMode: ViewMode,
    applyViewModeChange: (mode: ViewMode) => void,
  ) => {
    const scrollContainer = ganttViewportRef.current?.querySelector<HTMLElement>('.rmg-container') ?? null;
    const currentReferenceDate = scrollContainer
      ? getReferenceDateFromScroll(
        scrollContainer.scrollLeft,
        scrollContainer.clientWidth,
        timelineViewMode,
        startDate,
        endDate,
        activeGanttLeftColumnWidth,
      )
      : latestReferenceDateRef.current;
    setTimelineViewMode(nextViewMode);
    if (timelineViewModeStorageKey) {
      storeTimelineViewMode(timelineViewModeStorageKey, nextViewMode);
    }
    storeGanttState(ganttStateStorageKey, {
      timelineViewMode: nextViewMode,
      referenceDate: formatDateToAPI(currentReferenceDate ?? getInitialTimelineReferenceDate(storedGanttState, startDate, endDate)),
    });
    hasRestoredTimelineRef.current = false;
    applyViewModeChange(nextViewMode);
  }, [activeGanttLeftColumnWidth, endDate, ganttStateStorageKey, startDate, storedGanttState, timelineViewMode, timelineViewModeStorageKey]);

  const getCurrentTimelineReferenceDate = useCallback((): Date => {
    const scrollContainer = ganttViewportRef.current?.querySelector<HTMLElement>('.rmg-container') ?? null;
    if (scrollContainer) {
      return getReferenceDateFromScroll(
        scrollContainer.scrollLeft,
        scrollContainer.clientWidth,
        timelineViewMode,
        startDate,
        endDate,
        activeGanttLeftColumnWidth,
      );
    }

    return latestReferenceDateRef.current
      ?? getInitialTimelineReferenceDate(getStoredGanttState(ganttStateStorageKey), startDate, endDate);
  }, [activeGanttLeftColumnWidth, endDate, ganttStateStorageKey, startDate, timelineViewMode]);

  const scrollToTimelineReferenceDate = useCallback((date: Date): void => {
    const referenceDate = clampDate(date, startDate, endDate);
    latestReferenceDateRef.current = referenceDate;
    storeGanttState(ganttStateStorageKey, {
      calendarMode,
      timelineViewMode,
      referenceDate: formatDateToAPI(referenceDate),
    });

    const scrollContainer = ganttViewportRef.current?.querySelector<HTMLElement>('.rmg-container') ?? null;
    if (!scrollContainer) {
      return;
    }

    scrollContainer.scrollLeft = getTimelineScrollLeftForDate(
      referenceDate,
      timelineViewMode,
      startDate,
      scrollContainer,
      activeGanttLeftColumnWidth,
    );
  }, [activeGanttLeftColumnWidth, calendarMode, endDate, ganttStateStorageKey, startDate, timelineViewMode]);

  const handleShortcutTimelineViewModeChange = useCallback((nextViewMode: ViewMode): void => {
    const referenceDate = getCurrentTimelineReferenceDate();
    setTimelineViewMode(nextViewMode);
    if (timelineViewModeStorageKey) {
      storeTimelineViewMode(timelineViewModeStorageKey, nextViewMode);
    }
    storeGanttState(ganttStateStorageKey, {
      timelineViewMode: nextViewMode,
      referenceDate: formatDateToAPI(referenceDate),
    });
    latestReferenceDateRef.current = referenceDate;
    hasRestoredTimelineRef.current = false;
  }, [ganttStateStorageKey, getCurrentTimelineReferenceDate, timelineViewModeStorageKey]);

  const toggleCalendarEditMode = useCallback((): void => {
    if (calendarMode !== 'occupancy') {
      return;
    }
    setEditMode((value) => !value);
  }, [calendarMode]);

  const fetchCalendarData = useCallback(async (options: { showLoading?: boolean } = {}): Promise<void> => {
    const { showLoading = true } = options;
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      const [locationsRes, fieldsRes, bedsRes, plansRes, culturesRes] = await Promise.all([
        locationAPI.listAll(),
        fieldAPI.listAll(),
        bedAPI.listAll(),
        plantingPlanAPI.listAll(),
        cultureAPI.listAll(),
      ]);

      setLocations(locationsRes.results);
      setFields(fieldsRes.results);
      setBeds(bedsRes.results);
      setPlantingPlans(plansRes.results);
      setCultures(culturesRes.results);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(t('ganttChart:errors.load'));
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [t]);

  useEffect(() => {
    if (shouldShowProjectRequiredState) {
      setLoading(false);
      setError(null);
      setLocations([]);
      setFields([]);
      setBeds([]);
      setPlantingPlans([]);
      setCultures([]);
      return;
    }

    void fetchCalendarData();
  }, [displayYear, fetchCalendarData, shouldShowProjectRequiredState]);

  useEffect(() => {
    if (shouldShowProjectRequiredState) {
      return undefined;
    }

    const refreshVisibleCalendar = (): void => {
      if (document.visibilityState === 'hidden') {
        return;
      }
      void fetchCalendarData({ showLoading: false });
    };

    window.addEventListener('focus', refreshVisibleCalendar);
    document.addEventListener('visibilitychange', refreshVisibleCalendar);

    return () => {
      window.removeEventListener('focus', refreshVisibleCalendar);
      document.removeEventListener('visibilitychange', refreshVisibleCalendar);
    };
  }, [fetchCalendarData, shouldShowProjectRequiredState]);

  const refreshPlantingPlans = useCallback(async (): Promise<void> => {
    const plans = await plantingPlanAPI.listAll();
    setPlantingPlans(plans.results);
  }, []);

  const handleTaskUpdate = async (_groupId: string, updatedTask: GanttTask) => {
    try {
      const planIdMatch = updatedTask.id.match(/^plan-(\d+)-/);
      if (!planIdMatch) {
        console.error('Could not extract plan ID from task:', updatedTask.id);
        return;
      }

      const planId = parseInt(planIdMatch[1], 10);
      const plan = plantingPlans.find((entry) => entry.id === planId);
      if (!plan) {
        console.error('Could not find planting plan:', planId);
        return;
      }

      let newPlantingDate: string;
      const isGrowthTask = updatedTask.id.endsWith('-growth');

      if (isGrowthTask) {
        newPlantingDate = formatDateToAPI(updatedTask.startDate);
      } else {
        if (!plan.planting_date || !plan.harvest_date) {
          console.error('Cannot move harvest task for incomplete planting plan:', planId);
          return;
        }
        const originalPlantingDate = parseDateString(plan.planting_date);
        const originalHarvestDate = parseDateString(plan.harvest_date);
        const daysDifference = Math.round(
          (originalHarvestDate.getTime() - originalPlantingDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        const newPlantingDateObj = new Date(updatedTask.startDate);
        newPlantingDateObj.setDate(newPlantingDateObj.getDate() - daysDifference);
        newPlantingDate = formatDateToAPI(newPlantingDateObj);
      }

      const updatedPlan: Partial<PlantingPlan> = {
        ...plan,
        planting_date: newPlantingDate,
      };

      // Apply the new date optimistically before awaiting the API response.
      // TaskRow clears its local drag/preview state as soon as the mouse is
      // released, so without this the bar would immediately re-render from
      // the still-stale `plantingPlans` prop (briefly snapping back to its
      // pre-drag position) until the request resolves and moving again.
      setPlantingPlans((previous) => previous.map((entry) => (
        entry.id === planId ? { ...entry, ...updatedPlan } as PlantingPlan : entry
      )));

      const response = await plantingPlanAPI.update(planId, updatedPlan as PlantingPlan);
      setPlantingPlans((previous) => previous.map((entry) => (
        entry.id === planId ? response.data : entry
      )));
      setError(null);
    } catch (err) {
      console.error('Error updating planting plan:', err);
      setError(extractApiErrorMessage(err, t, t('ganttChart:errors.updatePlan')));
      try {
        await refreshPlantingPlans();
      } catch (refreshError) {
        console.error('Error reloading planting plans after failed update:', refreshError);
      }
      setGanttRenderKey((value) => value + 1);
    }
  };

  // ---------------------------------------------------------------------
  // Context navigation: right-click (desktop) / long-press (mobile) on a
  // bar or a Standort/Parzelle/Beet row opens a menu with "open X" links
  // into the relevant page plus edit/copy/delete. Double-click on a bar
  // is a shortcut for its "Anbauplan öffnen" action.
  // ---------------------------------------------------------------------
  const {
    openPlantingPlanFromTask,
    handleTaskDoubleClickToPlan,
    openCultureFromTask,
    addPlantingPlanForBed,
    openAreasPage,
    copyTaskSummary,
    deletePlantingPlanFromTask,
  } = useGanttTaskActions({ navigate, plantingPlans, setPlantingPlans, setError, t });

  const {
    contextMenuState,
    closeContextMenu,
    handleTaskContextMenu,
    handleGroupContextMenu,
    contextMenuActions,
  } = useGanttContextMenu({
    openPlantingPlanFromTask,
    openCultureFromTask,
    openAreasPage,
    copyTaskSummary,
    deletePlantingPlanFromTask,
    addPlantingPlanForBed,
  }, t);

  const activeSearchText = calendarMode === 'occupancy' ? occupancySearchText.trim() : seedlingSearchText.trim();
  const isCalendarFilterPopoverOpen = Boolean(calendarFilterAnchorEl);
  const clearActiveSearch = useCallback(() => {
    if (calendarMode === 'occupancy') {
      setOccupancySearchText('');
    } else {
      setSeedlingSearchText('');
    }
    setMobileSearchOpen(false);
  }, [calendarMode]);
  const persistGanttLeftColumnWidth = useCallback((width: number, useMobileLimits: boolean) => {
    storeGanttState(ganttStateStorageKey, {
      [useMobileLimits ? 'leftColumnWidthMobile' : 'leftColumnWidthDesktop']: clampGanttLeftColumnWidth(
        width,
        useMobileLimits,
      ),
    });
  }, [ganttStateStorageKey]);
  const handleGanttSidebarResizeStart = useCallback((event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const target = event.currentTarget;
    if (target.setPointerCapture) {
      target.setPointerCapture(event.pointerId);
    }

    const useMobileLimits = useMobileFilterLayout;
    const startClientX = event.clientX;
    const startWidth = activeGanttLeftColumnWidth;
    let pendingWidth = startWidth;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    const previousTouchAction = document.body.style.touchAction;
    let isFinished = false;

    const setActiveWidth = (width: number): void => {
      if (useMobileLimits) {
        setGanttLeftColumnWidthMobile(width);
      } else {
        setGanttLeftColumnWidthDesktop(width);
      }
    };

    const applyPendingWidth = (): void => {
      ganttSidebarWidthFrameRef.current = null;
      setActiveWidth(pendingWidth);
    };

    const queueWidthUpdate = (width: number): void => {
      pendingWidth = clampGanttLeftColumnWidth(width, useMobileLimits);
      if (ganttSidebarWidthFrameRef.current === null) {
        ganttSidebarWidthFrameRef.current = window.requestAnimationFrame(applyPendingWidth);
      }
    };

    const finishResize = (finishEvent?: Event): void => {
      if (isFinished) {
        return;
      }
      isFinished = true;
      finishEvent?.preventDefault();
      if (ganttSidebarWidthFrameRef.current !== null) {
        window.cancelAnimationFrame(ganttSidebarWidthFrameRef.current);
        ganttSidebarWidthFrameRef.current = null;
      }
      setActiveWidth(pendingWidth);
      persistGanttLeftColumnWidth(pendingWidth, useMobileLimits);
      setIsResizingGanttSidebar(false);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      document.body.style.touchAction = previousTouchAction;
      if (target.releasePointerCapture && target.hasPointerCapture?.(event.pointerId)) {
        target.releasePointerCapture(event.pointerId);
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishResize, { capture: true });
      window.removeEventListener('pointercancel', finishResize, { capture: true });
      target.removeEventListener('lostpointercapture', finishResize);
    };

    const handlePointerMove = (moveEvent: PointerEvent): void => {
      moveEvent.preventDefault();
      queueWidthUpdate(startWidth + moveEvent.clientX - startClientX);
    };

    setIsResizingGanttSidebar(true);
    document.body.style.cursor = useMobileLimits ? previousCursor : 'col-resize';
    document.body.style.userSelect = 'none';
    document.body.style.touchAction = 'none';
    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', finishResize, { passive: false, capture: true });
    window.addEventListener('pointercancel', finishResize, { passive: false, capture: true });
    target.addEventListener('lostpointercapture', finishResize, { passive: false });
  }, [activeGanttLeftColumnWidth, persistGanttLeftColumnWidth, useMobileFilterLayout]);
  const handleGanttSidebarResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    let nextWidth: number | null = null;
    if (event.key === 'ArrowLeft') {
      nextWidth = activeGanttLeftColumnWidth - GANTT_SIDEBAR_RESIZE_KEYBOARD_STEP;
    } else if (event.key === 'ArrowRight') {
      nextWidth = activeGanttLeftColumnWidth + GANTT_SIDEBAR_RESIZE_KEYBOARD_STEP;
    } else if (event.key === 'Home') {
      nextWidth = activeGanttLeftColumnMinWidth;
    } else if (event.key === 'End') {
      nextWidth = activeGanttLeftColumnMaxWidth;
    }

    if (nextWidth === null) {
      return;
    }

    event.preventDefault();
    const clampedWidth = clampGanttLeftColumnWidth(nextWidth, useMobileFilterLayout);
    if (useMobileFilterLayout) {
      setGanttLeftColumnWidthMobile(clampedWidth);
    } else {
      setGanttLeftColumnWidthDesktop(clampedWidth);
    }
    persistGanttLeftColumnWidth(clampedWidth, useMobileFilterLayout);
  }, [
    activeGanttLeftColumnMaxWidth,
    activeGanttLeftColumnMinWidth,
    activeGanttLeftColumnWidth,
    persistGanttLeftColumnWidth,
    useMobileFilterLayout,
  ]);

  const occupancyTaskGroups = useMemo<GanttTaskGroup[]>(() => {
    // Structural filter: "only occupied beds" removes empty beds (and any
    // now-childless field/location ancestors) from the tree entirely,
    // independent of expand/collapse state.
    const structurallyVisibleIds = onlyOccupiedBeds
      ? collectVisibleIdsWithAncestors(
        occupancyHierarchyNodes,
        new Set(
          occupancyHierarchyNodes
            .filter((node) => node.type === 'bed' && node.occupiedBedCount > 0)
            .map((node) => node.id),
        ),
      )
      : null;
    const prunedNodes = structurallyVisibleIds
      ? occupancyHierarchyNodes.filter((node) => structurallyVisibleIds.has(node.id))
      : occupancyHierarchyNodes;

    const fieldNameById = new Map<number, string>(
      prunedNodes
        .filter((node): node is OccupancyHierarchyNode & { fieldId: number } => node.type === 'field' && node.fieldId !== undefined)
        .map((node) => [node.fieldId, node.name]),
    );
    const locationNameById = new Map<number, string>(
      prunedNodes.filter((node) => node.type === 'location').map((node) => [node.locationId, node.name]),
    );

    const normalizedSearch = occupancySearchText.trim().toLowerCase();
    const isActivelyFiltering = Boolean(normalizedSearch)
      || occupancyLocationFilter !== 'all'
      || occupancyFieldFilter !== 'all';

    let visibleIds: Set<string | number> | null = null;
    if (isActivelyFiltering) {
      const matchedBedIds = new Set(
        prunedNodes
          .filter((node) => {
            if (node.type !== 'bed') {
              return false;
            }
            if (occupancyLocationFilter !== 'all' && node.locationId !== occupancyLocationFilter) {
              return false;
            }
            if (occupancyFieldFilter !== 'all' && node.fieldId !== occupancyFieldFilter) {
              return false;
            }
            if (!normalizedSearch) {
              return true;
            }
            const haystack = [
              node.name,
              node.fieldId !== undefined ? fieldNameById.get(node.fieldId) : undefined,
              locationNameById.get(node.locationId),
              ...node.tasks.map((task) => task.cultureName),
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            return haystack.includes(normalizedSearch);
          })
          .map((node) => node.id),
      );
      visibleIds = collectVisibleIdsWithAncestors(prunedNodes, matchedBedIds);
    }

    // Summaries come from the filtered node set (structural "nur belegte
    // Beete" pruning plus the location/field/search match), so the grey
    // summary can never claim more beds than the view actually lists.
    // Expansion state is intentionally not folded in — collapsing a row
    // hides it, it does not remove it from the structure.
    const summarizedNodes = visibleIds
      ? prunedNodes.filter((node) => visibleIds.has(node.id))
      : prunedNodes;
    const structureSummaries = buildOccupancyStructureSummaries(summarizedNodes);

    const flatRows = flattenTreeRows(prunedNodes, {
      expandedIds: expandedHierarchyIds,
      visibleIds,
    });

    return flatRows.map(({ node, depth, hasChildren }) => {
      const isExpandable = node.type !== 'bed' && hasChildren;
      const isExpanded = expandedHierarchyIds.has(node.id);

      const structureSummary = structureSummaries.get(node.id);
      const emptyRowLabel = structureSummary
        ? formatOccupancyStructureSummary(structureSummary, t)
        : undefined;

      const group: GanttTaskGroup = {
        id: node.id,
        name: node.name,
        tasks: node.tasks,
        depth,
        isExpandable,
        isExpanded,
        // Standort/Parzelle rows carry no bars — their structural summary is
        // rendered in the timeline area instead (see TaskRow's
        // `emptyRowLabel` handling), not as a second line in the left column.
        emptyRowLabel,
        // Standort/Parzelle rows have no bars of their own, so they don't
        // need a full task-row height — Beet rows keep the normal,
        // task-count-based height (rowHeightOverride left unset).
        rowHeightOverride: node.type === 'bed' ? undefined : OCCUPANCY_COMPACT_ROW_HEIGHT,
        locationId: node.locationId,
        fieldId: node.fieldId,
        bedId: node.bedId,
        area: node.area,
      };
      return group;
    });
  }, [
    expandedHierarchyIds,
    occupancyFieldFilter,
    occupancyHierarchyNodes,
    occupancyLocationFilter,
    occupancySearchText,
    onlyOccupiedBeds,
    t,
  ]);

  const handleToggleGroupExpand = useCallback((groupId: string) => {
    toggleHierarchyExpand(groupId);
  }, [toggleHierarchyExpand]);

  const seedlingTaskGroups = useMemo<GanttTaskGroup[]>(() => {
    const allGroups = buildSeedlingTaskGroups({
      locations: [],
      fields: [],
      beds: [],
      plantingPlans,
      cultures,
      displayYear,
    });

    const normalizedSearch = seedlingSearchText.trim().toLowerCase();
    if (!normalizedSearch) {
      return allGroups;
    }

    return allGroups.filter((group) => (
      (group.name || '').toLowerCase().includes(normalizedSearch)
    ));
  }, [cultures, displayYear, plantingPlans, seedlingSearchText]);

  const resolvedLocale = useMemo(() => {
    const language = i18n.resolvedLanguage || i18n.language || 'de';
    if (language === 'de') {
      return 'de-DE';
    }
    if (language === 'en') {
      return 'en-US';
    }
    return language;
  }, [i18n.language, i18n.resolvedLanguage]);
  const ganttLocaleText = useMemo(() => ({
    title: calendarMode === 'seedlings'
      ? t('ganttChart:chartLocaleText.titleSeedlings')
      : t('ganttChart:chartLocaleText.titleOccupancy'),
    resources: calendarMode === 'seedlings'
      ? t('ganttChart:chartLocaleText.resourcesSeedlings')
      : t('ganttChart:chartLocaleText.resources'),
    today: t('ganttChart:chartLocaleText.today'),
    actions: t('ganttChart:chartLocaleText.actions'),
    adjustProgress: t('ganttChart:chartLocaleText.adjustProgress'),
    viewModes: {
      [ViewMode.MINUTE]: t('ganttChart:chartLocaleText.viewModes.minute'),
      [ViewMode.HOUR]: t('ganttChart:chartLocaleText.viewModes.hour'),
      [ViewMode.DAY]: t('ganttChart:chartLocaleText.viewModes.day'),
      [ViewMode.WEEK]: t('ganttChart:chartLocaleText.viewModes.week'),
      [ViewMode.MONTH]: t('ganttChart:chartLocaleText.viewModes.month'),
      [ViewMode.QUARTER]: t('ganttChart:chartLocaleText.viewModes.quarter'),
      [ViewMode.YEAR]: t('ganttChart:chartLocaleText.viewModes.year'),
    },
  }), [calendarMode, t]);

  // Embeds the expand/collapse-one-level buttons directly in the Gantt task
  // list's own header (next to "Anbauflächen"/"Anzucht...") instead of a
  // separate control in the page's toolbar row. Occupancy-only (seedlings
  // mode has no expandable hierarchy) and hidden on phone-sized viewports;
  // still shown on tablets. Falls back to the plain localeText.resources
  // string (via core/GanttChart.tsx's own default) when undefined.
  const ganttHeaderLabel = useMemo(() => {
    if (calendarMode !== 'occupancy' || isPhoneViewport) {
      return undefined;
    }

    return (
      <>
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ganttLocaleText.resources}
        </Box>
        <Box sx={{ ml: 'auto', pl: 1.5, display: 'inline-flex', flexShrink: 0 }}>
          <HierarchyLevelButtons
            canExpand={hierarchyLevelToggle.canExpand}
            canCollapse={hierarchyLevelToggle.canCollapse}
            onExpandOneLevel={hierarchyLevelToggle.expandOneLevel}
            onCollapseOneLevel={hierarchyLevelToggle.collapseOneLevel}
          />
        </Box>
      </>
    );
  }, [calendarMode, ganttLocaleText.resources, hierarchyLevelToggle, isPhoneViewport]);

  const renderGanttHeader = useCallback(({
    title,
    viewMode,
    onViewModeChange,
    showViewModeSelector,
  }: {
    title: string;
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
    showViewModeSelector: boolean;
  }) => (
    <Box className="rmg-header">
      <Box
        className="rmg-header-content"
        sx={{
          gap: 1.5,
          alignItems: 'center',
          flexDirection: 'row',
        }}
      >
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: { xs: 1.5, md: 2.5 },
            minWidth: 0,
            flex: '0 1 auto',
            overflow: 'hidden',
          }}
        >
          <Typography
            component="h1"
            className="rmg-title"
            sx={{
              flex: '0 1 auto',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </Typography>
          {calendarMode === 'occupancy' ? (
            <AppTooltip
              title={(
                <Box component="span" sx={{ display: 'block' }}>
                  <Box component="span" sx={{ display: 'block', fontWeight: 600 }}>
                    {editMode ? t('ganttChart:moveModeActiveOption') : t('ganttChart:moveModeOption')}
                  </Box>
                  <Box component="span" sx={{ display: 'block' }}>
                    {editMode
                      ? t('ganttChart:moveModeActiveTooltipDescription')
                      : t('ganttChart:moveModeTooltipDescription')}
                  </Box>
                </Box>
              )}
            >
              <Button
                size="small"
                variant={editMode ? 'contained' : 'outlined'}
                color={editMode ? 'success' : 'inherit'}
                aria-label={t('ganttChart:moveModeOption')}
                aria-pressed={editMode}
                onClick={() => setEditMode((value) => !value)}
                sx={{
                  flexShrink: 0,
                  gap: { xs: 0, md: 0.75 },
                  minWidth: { xs: 44, md: 'auto' },
                  width: { xs: 44, md: 'auto' },
                  height: { xs: 44, md: 'auto' },
                  px: { xs: 0, md: 1.25 },
                  textTransform: 'none',
                  whiteSpace: 'nowrap',
                  ...(editMode
                    ? {}
                    : {
                      borderColor: 'success.main',
                      color: 'success.dark',
                      bgcolor: 'background.paper',
                      '&:hover': {
                        borderColor: 'success.dark',
                        bgcolor: 'success.50',
                      },
                    }),
                }}
              >
                <SwapHorizIcon
                  sx={{ display: { xs: 'inline-flex', md: editMode ? 'none' : 'inline-flex' } }}
                  fontSize="small"
                />
                {editMode ? (
                  <CheckCircleOutlineIcon
                    sx={{ display: { xs: 'none', md: 'inline-flex' } }}
                    fontSize="small"
                  />
                ) : null}
                <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                  {editMode ? t('ganttChart:moveModeActiveOption') : t('ganttChart:moveModeOption')}
                </Box>
              </Button>
            </AppTooltip>
          ) : null}
        </Box>
        {showViewModeSelector ? (
          <Box sx={{ ml: 'auto', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
            <Select
              size="small"
              value={viewMode}
              onChange={(event) => handleTimelineViewModeChange(event.target.value as ViewMode, onViewModeChange)}
              inputProps={{ 'aria-label': t('ganttChart:viewSelectorAriaLabel') }}
              sx={{
                display: { xs: 'inline-flex', md: 'none' },
                width: 'auto',
                minWidth: 0,
                bgcolor: 'background.paper',
                color: 'text.primary',
                '& .MuiSelect-select': {
                  width: 'auto',
                  minWidth: 0,
                  py: 0.75,
                  pl: 1,
                  pr: '26px !important',
                },
              }}
            >
              {GANTT_HEADER_VIEW_MODES.map((mode) => (
                <MenuItem key={mode} value={mode}>
                  {t(`ganttChart:chartLocaleText.viewModes.${mode}`)}
                </MenuItem>
              ))}
            </Select>
            <ButtonGroup
              size="small"
              variant="outlined"
              sx={{
                ...segmentedButtonGroupSx,
                display: { xs: 'none', md: 'inline-flex' },
              }}
              aria-label={t('ganttChart:chartLocaleText.titleOccupancy')}
            >
              {GANTT_HEADER_VIEW_MODES.map((mode) => (
                <Button
                  key={mode}
                  onClick={() => handleTimelineViewModeChange(mode, onViewModeChange)}
                  aria-pressed={viewMode === mode}
                  variant={viewMode === mode ? 'contained' : 'outlined'}
                  color={viewMode === mode ? 'success' : 'inherit'}
                  sx={{ ...getSegmentedActionButtonSx({ active: viewMode === mode }) }}
                >
                  {t(`ganttChart:chartLocaleText.viewModes.${mode}`)}
                </Button>
              ))}
            </ButtonGroup>
          </Box>
        ) : null}
      </Box>
    </Box>
  ), [
    calendarMode,
    editMode,
    handleTimelineViewModeChange,
    t,
  ]);

  const activeTaskGroups = calendarMode === 'occupancy' ? occupancyTaskGroups : seedlingTaskGroups;
  const getActiveGanttRowHeight = useCallback(
    (group: GanttTaskGroup): number => getCalendarGanttRowHeight(group, timelineViewMode, activeGanttLeftColumnWidth),
    [activeGanttLeftColumnWidth, timelineViewMode],
  );
  const renderWindow = useMemo(
    () => (useWindowedGanttRows
      ? getGanttRenderWindow(
        activeTaskGroups,
        ganttScrollTop,
        ganttViewportHeight,
        getActiveGanttRowHeight,
      )
      : {
        groups: activeTaskGroups,
        startIndex: 0,
        endIndex: activeTaskGroups.length,
        totalHeight: activeTaskGroups.reduce((total, group) => total + getActiveGanttRowHeight(group), 0),
      }),
    [activeTaskGroups, ganttScrollTop, ganttViewportHeight, getActiveGanttRowHeight, useWindowedGanttRows],
  );
  const renderedTaskGroups = renderWindow.groups;
  const isGanttRenderWindowVirtualized = useWindowedGanttRows
    && (renderWindow.startIndex > 0 || renderWindow.endIndex < activeTaskGroups.length);

  useLayoutEffect(() => {
    const boundary = ganttResizeBoundaryNode;
    if (!boundary) {
      return undefined;
    }

    let animationFrameId: number | null = null;
    const measureHandleTop = (): void => {
      animationFrameId = null;
      const ganttBody = boundary.querySelector<HTMLElement>('.rmg-container');
      if (!ganttBody) {
        setGanttResizeHandleTop(null);
        return;
      }
      const boundaryRect = boundary.getBoundingClientRect();
      const bodyRect = ganttBody.getBoundingClientRect();
      setGanttResizeHandleTop(Math.max(0, Math.round(bodyRect.top - boundaryRect.top)));
    };
    const queueMeasure = (): void => {
      if (animationFrameId === null) {
        animationFrameId = window.requestAnimationFrame(measureHandleTop);
      }
    };

    measureHandleTop();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', queueMeasure);
      return () => {
        window.removeEventListener('resize', queueMeasure);
        if (animationFrameId !== null) {
          window.cancelAnimationFrame(animationFrameId);
        }
      };
    }

    const observer = new ResizeObserver(queueMeasure);
    observer.observe(boundary);
    const ganttBody = boundary.querySelector<HTMLElement>('.rmg-container');
    if (ganttBody) {
      observer.observe(ganttBody);
    }

    return () => {
      observer.disconnect();
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [
    calendarMode,
    ganttResizeBoundaryNode,
    renderedTaskGroups.length,
    timelineViewMode,
  ]);

  const totalTimelineItems = useMemo(
    // For occupancy mode, count tasks across the full tree (every bed),
    // not just the currently visible/expanded rows — collapsing a field
    // shouldn't make the dataset look smaller than it is.
    () => (calendarMode === 'occupancy'
      ? occupancyHierarchyNodes.reduce((total, node) => total + node.tasks.length, 0)
      : activeTaskGroups.reduce((total, group) => total + group.tasks.length, 0)),
    [activeTaskGroups, calendarMode, occupancyHierarchyNodes],
  );
  const renderedTimelineItems = useMemo(
    () => renderedTaskGroups.reduce((total, group) => total + group.tasks.length, 0),
    [renderedTaskGroups],
  );
  const hasFields = fields.length > 0;
  const hasCultures = cultures.length > 0;
  const hasBeds = beds.length > 0;
  const hasPlantingPlans = plantingPlans.length > 0;
  const firstMissingPrerequisite = getFirstMissingCultivationPlanRequirement({
    hasFields,
    hasBeds,
    hasCultures,
  });
  const firstMissingRequirement = firstMissingPrerequisite ?? (hasPlantingPlans ? null : 'plans');
  const hasCalendarRequirements = firstMissingRequirement === null;
  const requirementActions = firstMissingRequirement
    ? getTranslatedProjectSetupActions(firstMissingRequirement, t)
    : [];
  const calendarCommands = useMemo<CommandSpec[]>(() => [
    {
      id: 'calendar.today',
      label: t('ganttChart:shortcuts.today'),
      group: 'navigation',
      keywords: ['kalender', 'heute', 'aktuell', 'periode'],
      shortcutHint: 'T',
      keys: { key: 't' },
      contextTags: ['calendar'],
      isEnabled: () => hasCalendarRequirements,
      action: () => scrollToTimelineReferenceDate(new Date()),
    },
    {
      id: 'calendar.previousPeriod',
      label: t('ganttChart:shortcuts.previousPeriod'),
      group: 'navigation',
      keywords: ['kalender', 'vorherige', 'periode', 'zurück'],
      shortcutHint: '←',
      keys: { key: 'ArrowLeft' },
      allowRepeat: true,
      contextTags: ['calendar'],
      isEnabled: () => hasCalendarRequirements,
      action: () => scrollToTimelineReferenceDate(addTimelinePeriod(getCurrentTimelineReferenceDate(), timelineViewMode, -1)),
    },
    {
      id: 'calendar.nextPeriod',
      label: t('ganttChart:shortcuts.nextPeriod'),
      group: 'navigation',
      keywords: ['kalender', 'nächste', 'periode', 'weiter'],
      shortcutHint: '→',
      keys: { key: 'ArrowRight' },
      allowRepeat: true,
      contextTags: ['calendar'],
      isEnabled: () => hasCalendarRequirements,
      action: () => scrollToTimelineReferenceDate(addTimelinePeriod(getCurrentTimelineReferenceDate(), timelineViewMode, 1)),
    },
    {
      id: 'calendar.previousLargePeriod',
      label: t('ganttChart:shortcuts.previousLargePeriod'),
      group: 'navigation',
      keywords: ['kalender', 'vorherige', 'große', 'periode', 'sprung', 'zurück'],
      shortcutHint: 'Shift+←',
      keys: { shift: true, key: 'ArrowLeft' },
      allowRepeat: true,
      contextTags: ['calendar'],
      isEnabled: () => hasCalendarRequirements,
      action: () => scrollToTimelineReferenceDate(addTimelinePeriodLarge(getCurrentTimelineReferenceDate(), timelineViewMode, -1)),
    },
    {
      id: 'calendar.nextLargePeriod',
      label: t('ganttChart:shortcuts.nextLargePeriod'),
      group: 'navigation',
      keywords: ['kalender', 'nächste', 'große', 'periode', 'sprung', 'weiter'],
      shortcutHint: 'Shift+→',
      keys: { shift: true, key: 'ArrowRight' },
      allowRepeat: true,
      contextTags: ['calendar'],
      isEnabled: () => hasCalendarRequirements,
      action: () => scrollToTimelineReferenceDate(addTimelinePeriodLarge(getCurrentTimelineReferenceDate(), timelineViewMode, 1)),
    },
    ...CALENDAR_SHORTCUT_VIEW_MODES.map<CommandSpec>(({ mode, shortcut, labelKey }) => ({
      id: `calendar.viewMode.${mode}`,
      label: t(`ganttChart:shortcuts.${labelKey}`),
      group: 'navigation',
      keywords: ['kalender', 'ansicht', mode],
      shortcutHint: shortcut,
      keys: { key: shortcut },
      contextTags: ['calendar'],
      isEnabled: () => hasCalendarRequirements,
      action: () => handleShortcutTimelineViewModeChange(mode),
    })),
    {
      id: 'calendar.focusSearch',
      label: t('ganttChart:shortcuts.focusSearch'),
      group: 'navigation',
      keywords: ['kalender', 'suchen', 'search', 'filter'],
      shortcutHint: '/',
      keys: { key: '/' },
      contextTags: ['calendar'],
      isEnabled: () => hasCalendarRequirements,
      action: focusSearch,
    },
    {
      id: 'calendar.showOccupancy',
      label: t('ganttChart:shortcuts.showOccupancy'),
      group: 'navigation',
      keywords: ['kalender', 'feldbelegung', 'felder'],
      shortcutHint: 'F',
      keys: { key: 'f' },
      contextTags: ['calendar'],
      isEnabled: () => hasCalendarRequirements,
      action: () => handleCalendarModeChange('occupancy'),
    },
    {
      id: 'calendar.showSeedlings',
      label: t('ganttChart:shortcuts.showSeedlings'),
      group: 'navigation',
      keywords: ['kalender', 'anzucht', 'jungpflanzen'],
      shortcutHint: 'A',
      keys: { key: 'a' },
      contextTags: ['calendar'],
      isEnabled: () => hasCalendarRequirements,
      action: () => handleCalendarModeChange('seedlings'),
    },
    {
      id: 'calendar.toggleEdit',
      label: editMode
        ? t('ganttChart:moveModeCommandDeactivate')
        : t('ganttChart:moveModeCommandActivate'),
      group: 'navigation',
      keywords: ['kalender', 'verschieben', 'drag-and-drop'],
      shortcutHint: 'Alt+E / Z',
      keys: { alt: true, key: 'e' },
      contextTags: ['calendar'],
      isEnabled: () => hasCalendarRequirements && calendarMode === 'occupancy',
      action: toggleCalendarEditMode,
    },
    {
      id: 'calendar.toggleEditPlain',
      label: editMode
        ? t('ganttChart:moveModeCommandDeactivate')
        : t('ganttChart:moveModeCommandActivate'),
      group: 'navigation',
      keywords: ['kalender', 'verschieben', 'drag-and-drop'],
      shortcutHint: 'Z',
      keys: { key: 'z' },
      contextTags: ['calendar'],
      isEnabled: () => hasCalendarRequirements && calendarMode === 'occupancy',
      action: toggleCalendarEditMode,
    },
  ], [
    calendarMode,
    editMode,
    focusSearch,
    getCurrentTimelineReferenceDate,
    handleCalendarModeChange,
    handleShortcutTimelineViewModeChange,
    hasCalendarRequirements,
    scrollToTimelineReferenceDate,
    t,
    timelineViewMode,
    toggleCalendarEditMode,
  ]);

  useRegisterCommands('calendar-page', calendarCommands);

  useEffect(() => {
    if (loading || !hasCalendarRequirements || !useWindowedGanttRows) {
      if (!useWindowedGanttRows) {
        setGanttScrollTop(0);
      }
      return;
    }

    // Read the persisted offset fresh instead of relying on the `storedGanttState`
    // memo (captured once per storage key): every scroll tick writes the latest
    // offset to storage via `storeGanttState`, but that memo never re-reads it, so
    // reusing it here reapplied a stale (often 0) offset on every calendarMode/loading
    // change, snapping the view back to the top mid-session.
    const storedRowScrollTop = getStoredGanttState(ganttStateStorageKey)?.rowScrollTop;
    const requestedScrollTop = typeof storedRowScrollTop === 'number' && Number.isFinite(storedRowScrollTop)
      ? Math.max(0, storedRowScrollTop)
      : 0;
    // The stored offset is shared across calendar modes/projects with differing row
    // counts, so it can exceed what's actually scrollable here. Assign it to the DOM
    // first and read back the browser-clamped value, otherwise the absolutely
    // positioned chart content (top: ganttScrollTop) renders offset past the visible
    // viewport, leaving a blank gap above it instead of starting at the top.
    let appliedScrollTop = requestedScrollTop;
    if (ganttViewportRef.current) {
      ganttViewportRef.current.scrollTop = requestedScrollTop;
      appliedScrollTop = ganttViewportRef.current.scrollTop;
    }
    setGanttScrollTop(appliedScrollTop);
    hasRestoredTimelineRef.current = false;
  }, [activeProjectId, calendarMode, ganttStateStorageKey, hasCalendarRequirements, loading, useWindowedGanttRows]);

  useEffect(() => {
    if (loading || !hasCalendarRequirements) {
      return undefined;
    }

    let timeoutId: number | null = null;
    let animationFrameId: number | null = null;
    let isCancelled = false;
    let attempt = 0;

    const restoreTimelineScroll = (): void => {
      animationFrameId = window.requestAnimationFrame(() => {
        if (isCancelled) {
          return;
        }

        const scrollContainer = ganttViewportRef.current?.querySelector<HTMLElement>('.rmg-container') ?? null;
        if (!scrollContainer) {
          return;
        }

        const referenceDate = getInitialTimelineReferenceDate(
          getStoredGanttState(ganttStateStorageKey),
          startDate,
          endDate,
        );
        const nextScrollLeft = getTimelineScrollLeftForDate(
          referenceDate,
          timelineViewMode,
          startDate,
          scrollContainer,
          activeGanttLeftColumnWidthRef.current,
        );
        const previousScrollBehavior = scrollContainer.style.scrollBehavior;
        scrollContainer.style.scrollBehavior = 'auto';
        scrollContainer.scrollLeft = nextScrollLeft;
        scrollContainer.style.scrollBehavior = previousScrollBehavior;

        if (nextScrollLeft > 0 && scrollContainer.scrollLeft === 0 && attempt < 5) {
          attempt += 1;
          timeoutId = window.setTimeout(restoreTimelineScroll, 50);
          return;
        }

        latestReferenceDateRef.current = referenceDate;
        hasRestoredTimelineRef.current = true;
        storeGanttState(ganttStateStorageKey, {
          calendarMode,
          timelineViewMode,
          referenceDate: formatDateToAPI(referenceDate),
        });
      });
    };

    timeoutId = window.setTimeout(restoreTimelineScroll, 0);

    return () => {
      isCancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [
    activeProjectId,
    calendarMode,
    endDate,
    ganttStateStorageKey,
    hasCalendarRequirements,
    loading,
    startDate,
    timelineViewMode,
  ]);

  useEffect(() => {
    if (loading || !hasCalendarRequirements) {
      return undefined;
    }

    const scrollContainer = ganttViewportRef.current?.querySelector<HTMLElement>('.rmg-container') ?? null;
    if (!scrollContainer) {
      return undefined;
    }

    const handleTimelineScroll = (): void => {
      if (!hasRestoredTimelineRef.current) {
        return;
      }
      const referenceDate = getReferenceDateFromScroll(
        scrollContainer.scrollLeft,
        scrollContainer.clientWidth,
        timelineViewMode,
        startDate,
        endDate,
        activeGanttLeftColumnWidth,
      );
      latestReferenceDateRef.current = referenceDate;
      storeGanttState(ganttStateStorageKey, {
        calendarMode,
        timelineViewMode,
        referenceDate: formatDateToAPI(referenceDate),
      });
    };

    scrollContainer.addEventListener('scroll', handleTimelineScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleTimelineScroll);
  }, [activeGanttLeftColumnWidth, calendarMode, endDate, ganttStateStorageKey, hasCalendarRequirements, loading, startDate, timelineViewMode]);

  useEffect(() => {
    if (loading || !hasCalendarRequirements || calendarMode !== 'occupancy' || !editMode) {
      return undefined;
    }

    const viewport = ganttViewportRef.current;
    if (!viewport) {
      return undefined;
    }

    let activeTouchId: number | null = null;
    let activeTaskTarget: HTMLElement | null = null;
    let isMouseDragReady = false;
    let dragReadyAnimationFrame: number | null = null;
    let pendingMovePoint: SyntheticMousePoint | null = null;
    let pendingEndPoint: SyntheticMousePoint | null = null;

    const resetTouchDrag = (): void => {
      activeTouchId = null;
      activeTaskTarget = null;
      isMouseDragReady = false;
      pendingMovePoint = null;
      pendingEndPoint = null;
      if (dragReadyAnimationFrame !== null) {
        window.cancelAnimationFrame(dragReadyAnimationFrame);
        dragReadyAnimationFrame = null;
      }
    };

    const flushPendingTouchDrag = (): void => {
      isMouseDragReady = true;
      dragReadyAnimationFrame = null;
      if (pendingMovePoint) {
        const moveTarget = document.elementFromPoint?.(pendingMovePoint.clientX, pendingMovePoint.clientY)
          ?? activeTaskTarget
          ?? document;
        dispatchSyntheticMouseEvent(moveTarget, 'mousemove', pendingMovePoint);
        pendingMovePoint = null;
      }
      if (pendingEndPoint) {
        dispatchSyntheticMouseEvent(document, 'mouseup', pendingEndPoint);
        resetTouchDrag();
      }
    };

    const getTrackedTouch = (event: TouchEvent): Touch | null => {
      if (activeTouchId === null) {
        return getPrimaryTouch(event);
      }

      const touches = Array.from(event.touches);
      return touches.find((touch) => touch.identifier === activeTouchId) ?? getPrimaryTouch(event);
    };

    const handleTouchStart = (event: TouchEvent): void => {
      if (event.touches.length !== 1) {
        return;
      }

      const target = event.target instanceof HTMLElement
        ? event.target.closest<HTMLElement>('[data-rmg-component="task"]')
        : null;
      const touch = getPrimaryTouch(event);
      if (!target || !touch) {
        return;
      }

      activeTouchId = touch.identifier;
      activeTaskTarget = target;
      isMouseDragReady = false;
      event.preventDefault();
      dispatchSyntheticMouseEvent(target, 'mousedown', toSyntheticMousePoint(touch));
      dragReadyAnimationFrame = window.requestAnimationFrame(flushPendingTouchDrag);
    };

    const handleTouchMove = (event: TouchEvent): void => {
      if (activeTouchId === null || !activeTaskTarget) {
        return;
      }

      const touch = getTrackedTouch(event);
      if (!touch) {
        return;
      }

      event.preventDefault();
      const point = toSyntheticMousePoint(touch);
      if (!isMouseDragReady) {
        pendingMovePoint = point;
        return;
      }
      const moveTarget = document.elementFromPoint?.(point.clientX, point.clientY)
        ?? activeTaskTarget
        ?? document;
      dispatchSyntheticMouseEvent(moveTarget, 'mousemove', point);
    };

    const finishTouchDrag = (event: TouchEvent): void => {
      if (activeTouchId === null || !activeTaskTarget) {
        return;
      }

      const touch = Array.from(event.changedTouches).find((candidate) => candidate.identifier === activeTouchId)
        ?? getPrimaryTouch(event);
      if (touch) {
        event.preventDefault();
        const point = toSyntheticMousePoint(touch);
        if (!isMouseDragReady) {
          pendingEndPoint = point;
          return;
        }
        dispatchSyntheticMouseEvent(document, 'mouseup', point);
      }
      resetTouchDrag();
    };

    viewport.addEventListener('touchstart', handleTouchStart, { passive: false });
    viewport.addEventListener('touchmove', handleTouchMove, { passive: false });
    viewport.addEventListener('touchend', finishTouchDrag, { passive: false });
    viewport.addEventListener('touchcancel', finishTouchDrag, { passive: false });

    return () => {
      viewport.removeEventListener('touchstart', handleTouchStart);
      viewport.removeEventListener('touchmove', handleTouchMove);
      viewport.removeEventListener('touchend', finishTouchDrag);
      viewport.removeEventListener('touchcancel', finishTouchDrag);
      resetTouchDrag();
    };
  }, [calendarMode, editMode, hasCalendarRequirements, loading]);

  useEffect(() => {
    const viewport = ganttViewportRef.current;
    if (!viewport) {
      return undefined;
    }

    const updateViewportHeight = (): void => {
      setGanttViewportHeight(viewport.clientHeight);
    };
    updateViewportHeight();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateViewportHeight);
      return () => window.removeEventListener('resize', updateViewportHeight);
    }
    const observer = new ResizeObserver(updateViewportHeight);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  // Caps the calendar panel's height so its bottom edge sits a fixed
  // GANTT_VIEWPORT_BOTTOM_MARGIN_PX below the viewport bottom, instead of a
  // viewport-percentage cap that leaves an oversized gap on tall screens
  // (or crowds the fold on short ones). Re-measures on window resize and
  // whenever layout above the panel (filters, banners) can change height.
  useLayoutEffect(() => {
    if (useMobileFilterLayout) {
      return undefined;
    }
    const viewport = ganttViewportRef.current;
    if (!viewport) {
      return undefined;
    }

    const measure = (): void => {
      const top = viewport.getBoundingClientRect().top;
      setGanttMaxHeightPx(
        Math.max(GANTT_VIEWPORT_MIN_HEIGHT_PX, window.innerHeight - top - GANTT_VIEWPORT_BOTTOM_MARGIN_PX),
      );
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [
    useMobileFilterLayout,
    calendarMode,
    error,
    mobileSearchOpen,
    isCalendarFilterPopoverOpen,
    activeTaskGroups.length,
  ]);

  useEffect(() => {
    if (!import.meta.env.DEV || loading) {
      return;
    }

    console.debug('[Gantt diagnostics]', {
      beds: beds.length,
      plantingPlans: plantingPlans.length,
      totalRows: activeTaskGroups.length,
      totalTimelineItems,
      renderedRows: renderedTaskGroups.length,
      renderedTimelineItems,
      firstRenderedRow: renderWindow.startIndex,
      lastRenderedRow: renderWindow.endIndex,
    });
  }, [
    activeTaskGroups.length,
    beds.length,
    loading,
    plantingPlans.length,
    renderWindow.endIndex,
    renderWindow.startIndex,
    renderedTaskGroups.length,
    renderedTimelineItems,
    totalTimelineItems,
  ]);
  const viewModeActions = useMemo<TopbarContextAction[]>(() => (hasCalendarRequirements ? [
    {
      id: 'calendar-view-mode-occupancy',
      label: t('ganttChart:modes.occupancy'),
      ariaLabel: t('ganttChart:modes.occupancy'),
      onClick: () => handleCalendarModeChange('occupancy'),
      active: calendarMode === 'occupancy',
      groupId: 'calendar-view-mode',
      tooltip: t('ganttChart:modeTooltips.occupancy'),
    },
    {
      id: 'calendar-view-mode-seedlings',
      label: t('ganttChart:modes.seedlings'),
      ariaLabel: t('ganttChart:modes.seedlings'),
      onClick: () => handleCalendarModeChange('seedlings'),
      active: calendarMode === 'seedlings',
      groupId: 'calendar-view-mode',
      tooltip: t('ganttChart:modeTooltips.seedlings'),
    },
  ] : []), [calendarMode, handleCalendarModeChange, hasCalendarRequirements, t]);
  const requirementEmptyStateTitleKey = firstMissingRequirement === 'cultures'
    ? 'ganttChart:emptyStates.states.cultures.title'
    : firstMissingRequirement === 'plans'
      ? 'ganttChart:emptyStates.states.plans.title'
      : 'ganttChart:emptyStates.requirementsTitle';
  const requirementEmptyStateDescriptionKey = firstMissingRequirement === 'cultures'
    ? 'ganttChart:emptyStates.states.cultures.description'
    : firstMissingRequirement === 'plans'
      ? 'ganttChart:emptyStates.states.plans.description'
      : 'ganttChart:emptyStates.requirementsDescription';

  const renderOccupancyTooltip = useCallback(({ task }: { task: GanttTask }) => (
    <Box sx={{ p: 0.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.75 }}>
        {formatSeedlingTooltipTitle(task)}
      </Typography>
      {buildOccupancyTooltipDetails(task).map((detail) => (
        <Typography key={`${task.id}-${detail.labelKey}`} variant="body2" sx={{ display: 'block', lineHeight: 1.4 }}>
          {t(`ganttChart:tooltip.${detail.labelKey}`)}: {detail.value}
        </Typography>
      ))}
    </Box>
  ), [t]);

  const renderSeedlingTooltip = useCallback(({ task }: { task: GanttTask }) => (
    <Box sx={{ p: 0.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.75 }}>
        {formatSeedlingTooltipTitle(task)}
      </Typography>
      {buildSeedlingTooltipDetails(task).map((detail) => (
        <Typography key={`${task.id}-${detail.labelKey}`} variant="body2" sx={{ display: 'block', lineHeight: 1.4 }}>
          {t(`ganttChart:tooltip.${detail.labelKey}`)}: {detail.labelKey === 'propagationDuration'
            ? `${detail.value} ${t('ganttChart:days')}`
            : detail.value}
        </Typography>
      ))}
    </Box>
  ), [t]);

  const contextActions = useMemo<TopbarContextAction[]>(() => [], []);

  useTopbarContextActions(setTopbarContextActions, contextActions);
  useTopbarTitleActions(setTopbarTitleActions, viewModeActions);

  const calendarGanttChart = (
    <GanttRenderBoundary fallback={<Alert severity="error">{t('ganttChart:errors.render')}</Alert>}>
      <GanttChartWithFocusMode
        key={`${calendarMode}-${ganttRenderKey}`}
        tasks={renderedTaskGroups}
        locale={resolvedLocale}
        localeText={ganttLocaleText}
        headerLabel={ganttHeaderLabel}
        viewMode={timelineViewMode}
        leftColumnWidth={activeGanttLeftColumnWidth}
        rowHeight={GANTT_ROW_HEIGHT}
        startDate={startDate}
        endDate={endDate}
        focusMode={false}
        editMode={calendarMode === 'occupancy' ? editMode : false}
        allowTaskResize={false}
        allowTaskMove={calendarMode === 'occupancy' && editMode}
        showProgress={false}
        darkMode={false}
        onTaskUpdate={calendarMode === 'occupancy' && editMode ? handleTaskUpdate : undefined}
        onToggleGroupExpand={calendarMode === 'occupancy' ? handleToggleGroupExpand : undefined}
        onTaskDoubleClick={handleTaskDoubleClickToPlan}
        onTaskContextMenu={handleTaskContextMenu}
        onGroupContextMenu={calendarMode === 'occupancy' ? handleGroupContextMenu : undefined}
        renderHeader={renderGanttHeader}
        renderTooltip={({ task }: { task: GanttTask }) => (calendarMode === 'seedlings'
          ? renderSeedlingTooltip({ task })
          : renderOccupancyTooltip({ task }))}
        renderTask={calendarMode === 'seedlings'
          ? ({ task }: { task: GanttTask; leftPx: number; widthPx: number; topPx: number }) => (
              <Box
                sx={{
                  width: '100%',
                  height: 26,
                  px: 1,
                  borderRadius: 1,
                  backgroundColor: task.color || '#3b82f6',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  boxSizing: 'border-box',
                  cursor: 'default',
                }}
              >
                <Typography
                  variant="caption"
                  className="rmg-task-item-name-maskable"
                  sx={{ color: 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}
                >
                  {typeof task.plantsCount === 'number' && task.plantsCount > 0
                    ? `${task.name} · ${formatPlantCount(task.plantsCount)} ${t('ganttChart:seedlings.plantsUnit')}`
                    : task.name}
                </Typography>
              </Box>
            )
          : undefined}
      />
    </GanttRenderBoundary>
  );

  if (loading) {
    return (
      <PageContainer variant="workspacePage">
        <PageSurface variant="fullWorkspace" sx={{ py: 2 }}>
          <Typography variant="body1">{t('ganttChart:loading')}</Typography>
        </PageSurface>
      </PageContainer>
    );
  }

  if (shouldShowProjectRequiredState && missingProjectReason) {
    return (
      <PageContainer variant="workspacePage">
        <PageSurface variant="fullWorkspace">
          <ProjectRequiredState reason={missingProjectReason} />
        </PageSurface>
      </PageContainer>
    );
  }

  return (
    <PageContainer variant="workspacePage">
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {!hasCalendarRequirements ? (
          <PageSurface variant="fullWorkspace" sx={{ mt: 0.5 }}>
          <Box className="gantt-container-wrapper w-full min-w-0 overflow-hidden mt-2" sx={{ border: '1px solid', borderColor: 'surface.surfaceSoftBorder', borderRadius: 2, bgcolor: 'surface.surfaceBackground' }}>
            <Box sx={{ p: 2 }}>
              <EmptyStateCard
                title={t(requirementEmptyStateTitleKey)}
                description={t(requirementEmptyStateDescriptionKey)}
                checklist={[
                  ...(firstMissingRequirement === 'beds' ? [{ label: t('ganttChart:requirements.bed.label'), done: false, missingLabel: t('ganttChart:requirements.bed.missing') }] : []),
                  ...(firstMissingRequirement === 'cultures' ? [{ label: t('ganttChart:requirements.culture.label'), done: false, missingLabel: t('ganttChart:requirements.culture.missing') }] : []),
                ]}
                actions={requirementActions}
              />
            </Box>
          </Box>
          </PageSurface>
        ) : (
          <PageSurface variant="fullWorkspace" sx={{ mt: 0.5 }}>
          {calendarMode === 'occupancy' && (
            <Box
              data-testid="occupancy-tree-filters"
              sx={{
                mb: { xs: 0, md: 1.5 },
              }}
            >
              {useMobileFilterLayout ? (
                <Stack spacing={0}>
                  <OccupancyMobileFilterBar
                    searchExpanded={Boolean(mobileSearchOpen || activeSearchText)}
                    searchText={occupancySearchText}
                    onSearchTextChange={setOccupancySearchText}
                    searchInputRef={searchInputRef}
                    onClearSearch={clearActiveSearch}
                    onOpenSearch={() => setMobileSearchOpen(true)}
                    filterPopoverOpen={isCalendarFilterPopoverOpen}
                    activeFilterCount={activeHierarchyFilterCount}
                    onOpenFilterPopover={(event) => setCalendarFilterAnchorEl(event.currentTarget)}
                  />
                  <CalendarFiltersPopover
                    anchorEl={calendarFilterAnchorEl}
                    onClose={() => setCalendarFilterAnchorEl(null)}
                    locations={locations}
                    fieldOptions={occupancyFieldOptions}
                    locationFilter={occupancyLocationFilter}
                    onLocationFilterChange={(value) => {
                      setOccupancyLocationFilter(value);
                      setOccupancyFieldFilter('all');
                    }}
                    fieldFilter={occupancyFieldFilter}
                    onFieldFilterChange={setOccupancyFieldFilter}
                    onlyOccupiedBeds={onlyOccupiedBeds}
                    onOnlyOccupiedBedsChange={setOnlyOccupiedBeds}
                    onReset={() => {
                      resetOccupancyHierarchyFilters();
                      setCalendarFilterAnchorEl(null);
                    }}
                  />
                </Stack>
              ) : (
                <OccupancyFilterRow
                  searchText={occupancySearchText}
                  onSearchTextChange={setOccupancySearchText}
                  searchInputRef={searchInputRef}
                  locations={locations}
                  fieldOptions={occupancyFieldOptions}
                  locationFilter={occupancyLocationFilter}
                  onLocationFilterChange={(value) => {
                    setOccupancyLocationFilter(value);
                    setOccupancyFieldFilter('all');
                  }}
                  fieldFilter={occupancyFieldFilter}
                  onFieldFilterChange={setOccupancyFieldFilter}
                  onlyOccupiedBeds={onlyOccupiedBeds}
                  onOnlyOccupiedBedsChange={setOnlyOccupiedBeds}
                />
              )}
            </Box>
          )}
          {calendarMode === 'seedlings' && (
            <SeedlingFilters
              useMobileLayout={useMobileFilterLayout}
              searchExpanded={Boolean(mobileSearchOpen || activeSearchText)}
              searchText={seedlingSearchText}
              onSearchTextChange={setSeedlingSearchText}
              searchInputRef={searchInputRef}
              onClearSearch={clearActiveSearch}
              onOpenSearch={() => setMobileSearchOpen(true)}
            />
          )}
          <Box
            className={`gantt-container-wrapper gantt-container-wrapper--${calendarMode} w-full min-w-0 overflow-hidden`}
            sx={{
              mt: { xs: 0.75, md: 2 },
              border: '1px solid',
              borderColor: 'surface.surfaceSoftBorder',
              borderRadius: 2,
              bgcolor: 'surface.surfaceBackground',
            }}
          >
            <Box
              ref={handleGanttResizeBoundaryRef}
              sx={{
                position: 'relative',
              }}
            >
              <Box
                ref={ganttViewportRef}
                data-testid="gantt-virtual-viewport"
                onScroll={(event) => {
                  if (!useWindowedGanttRows) {
                    return;
                  }
                  const nextScrollTop = event.currentTarget.scrollTop;
                  setGanttScrollTop(nextScrollTop);
                  storeGanttState(ganttStateStorageKey, {
                    calendarMode,
                    timelineViewMode,
                    rowScrollTop: nextScrollTop,
                  });
                }}
                sx={{
                  position: 'relative',
                  maxHeight: { xs: 'none', md: ganttMaxHeightPx ? `${ganttMaxHeightPx}px` : 'none' },
                  overflowY: { xs: 'visible', md: 'auto' },
                  overflowX: 'hidden',
                  overscrollBehavior: { xs: 'auto', md: 'contain' },
                }}
              >
                {isGanttRenderWindowVirtualized ? (
                  <Box sx={{ height: renderWindow.totalHeight, position: 'relative' }}>
                    <Box
                      sx={{
                        position: 'absolute',
                        top: ganttScrollTop,
                        left: 0,
                        right: 0,
                      }}
                    >
                      {calendarGanttChart}
                    </Box>
                  </Box>
                ) : calendarGanttChart}
              </Box>
              {ganttResizeHandleTop !== null ? (
                <Box
                  component="div"
                  role="separator"
                  tabIndex={0}
                  aria-orientation="vertical"
                  aria-label={t('ganttChart:sidebar.resizeHandle')}
                  aria-valuemin={activeGanttLeftColumnMinWidth}
                  aria-valuemax={activeGanttLeftColumnMaxWidth}
                  aria-valuenow={activeGanttLeftColumnWidth}
                  data-resizing={isResizingGanttSidebar ? 'true' : undefined}
                  onPointerDown={handleGanttSidebarResizeStart}
                  onKeyDown={handleGanttSidebarResizeKeyDown}
                  sx={{
                    position: 'absolute',
                    top: `${ganttResizeHandleTop}px`,
                    bottom: 0,
                    left: `${activeGanttLeftColumnWidth - ganttSidebarResizeHandleHitboxWidth / 2}px`,
                    zIndex: 360,
                    width: ganttSidebarResizeHandleHitboxWidth,
                    appearance: 'none',
                    p: 0,
                    m: 0,
                    border: 0,
                    borderRadius: 0,
                    bgcolor: 'transparent !important',
                    background: 'transparent !important',
                    boxShadow: 'none',
                    cursor: { xs: 'default', md: 'col-resize' },
                    touchAction: 'none',
                    WebkitTapHighlightColor: 'transparent',
                    '&, &:hover, &:active, &[data-resizing="true"]': {
                      bgcolor: 'transparent !important',
                      background: 'transparent !important',
                    },
                    '&:hover .GanttSidebarResizeHandle-line, &:focus-visible .GanttSidebarResizeHandle-line, &[data-resizing="true"] .GanttSidebarResizeHandle-line': {
                      width: '2px',
                      bgcolor: 'text.secondary',
                      opacity: 1,
                    },
                    '&:hover .GanttSidebarResizeHandle-grip, &:focus-visible .GanttSidebarResizeHandle-grip, &[data-resizing="true"] .GanttSidebarResizeHandle-grip': {
                      opacity: 1,
                    },
                    '&:focus-visible': {
                      outline: '2px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: -2,
                    },
                  }}
                >
                  <Box
                    className="GanttSidebarResizeHandle-line"
                    data-testid="gantt-sidebar-resize-line"
                    sx={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: '50%',
                      width: isResizingGanttSidebar ? '2px' : '1px',
                      transform: 'translateX(-50%)',
                      bgcolor: isResizingGanttSidebar ? 'text.secondary' : 'divider',
                      opacity: isResizingGanttSidebar ? 1 : 0.7,
                      pointerEvents: 'none',
                      transition: 'background-color 120ms ease, opacity 120ms ease, width 120ms ease',
                    }}
                  />
                  <Box
                    className="GanttSidebarResizeHandle-grip"
                    data-testid="gantt-sidebar-resize-grip"
                    aria-hidden="true"
                    sx={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      display: { xs: 'none', md: 'flex' },
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 16,
                      height: 24,
                      transform: 'translate(-50%, -50%)',
                      color: 'text.secondary',
                      opacity: isResizingGanttSidebar ? 1 : 0,
                      pointerEvents: 'none',
                      transition: 'opacity 120ms ease',
                    }}
                  >
                    <DragIndicatorIcon sx={{ fontSize: 16 }} />
                  </Box>
                </Box>
              ) : null}
            </Box>
          </Box>
          </PageSurface>
        )}

      <CustomContextMenu
        open={contextMenuState !== null}
        onClose={closeContextMenu}
        mouseX={contextMenuState?.mouseX}
        mouseY={contextMenuState?.mouseY}
      >
        {contextMenuActions.flatMap((action, index) => {
          const previousAction = contextMenuActions[index - 1];
          const shouldSeparateGroup = previousAction !== undefined && previousAction.group !== action.group;
          const menuItem = (
            <MenuItem
              key={action.id}
              onClick={() => {
                closeContextMenu();
                action.onClick();
              }}
              sx={{ color: action.group === 'danger' ? 'error.main' : undefined }}
            >
              {action.label}
            </MenuItem>
          );
          return shouldSeparateGroup
            ? [<Divider key={`${action.id}-divider`} role="separator" />, menuItem]
            : [menuItem];
        })}
      </CustomContextMenu>
    </PageContainer>
  );
}

export default GanttChartPage;
