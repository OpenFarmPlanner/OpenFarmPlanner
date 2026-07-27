export const CONTINUOUS_SCROLL_PAGE_SIZE = 100;
export const CONTINUOUS_SCROLL_REQUESTED_ROW_HEIGHT_PX = 44;
export const CONTINUOUS_SCROLL_COMPACT_ROW_HEIGHT_PX = 30;
export const CONTINUOUS_SCROLL_HEADER_HEIGHT_PX = 56;
export const CONTINUOUS_SCROLL_FOOTER_HEIGHT_PX = 61;
export const CONTINUOUS_SCROLL_BORDER_HEIGHT_PX = 2;
// Slack kept below the grid so it sits comfortably above the fold. Small
// margins here are risky: any tiny under-measurement (rounding, a font
// metrics difference, browser chrome) can push the page a few pixels taller
// than the viewport, which brings in a second, native page-level scrollbar
// right alongside the grid's own continuous-scroll thumb.
export const CONTINUOUS_SCROLL_BOTTOM_MARGIN_PX = 35;
export const CONTINUOUS_SCROLL_MIN_HEIGHT_PX = 240;
export const DATA_GRID_ROOT_SELECTOR = '.MuiDataGrid-root';
export const DATA_GRID_VIRTUAL_SCROLLER_SELECTOR = '.MuiDataGrid-virtualScroller';
export const DATA_GRID_MAIN_SELECTOR = '.MuiDataGrid-main';
export const DATA_GRID_CONTINUOUS_SCROLL_FOOTER_CLASS = 'ofp-data-grid-continuous-footer';
export const CONTINUOUS_SCROLL_FIT_EPSILON_PX = 2;

export const cssEscape = (value: string): string => {
  if (typeof window !== 'undefined' && window.CSS?.escape) {
    return window.CSS.escape(value);
  }
  return value.replace(/["\\]/g, '\\$&');
};

export type ContinuousScrollLayoutHeights = {
  header: number;
  footer: number;
  border: number;
};

export const DEFAULT_CONTINUOUS_SCROLL_LAYOUT_HEIGHTS: ContinuousScrollLayoutHeights = {
  header: CONTINUOUS_SCROLL_HEADER_HEIGHT_PX,
  footer: CONTINUOUS_SCROLL_FOOTER_HEIGHT_PX,
  border: CONTINUOUS_SCROLL_BORDER_HEIGHT_PX,
};

export const getElementHeight = (element: Element | null, fallback: number): number => {
  if (!(element instanceof HTMLElement)) {
    return fallback;
  }

  const measuredHeight = element.getBoundingClientRect().height;
  return measuredHeight > 0 ? measuredHeight : fallback;
};

export const getVerticalBorderHeight = (element: Element | null, fallback: number): number => {
  if (!(element instanceof HTMLElement)) {
    return fallback;
  }

  const styles = window.getComputedStyle(element);
  const borderHeight = Number.parseFloat(styles.borderTopWidth || '0') + Number.parseFloat(styles.borderBottomWidth || '0');
  return Number.isFinite(borderHeight) ? borderHeight : fallback;
};

export const continuousScrollLayoutHeightsEqual = (
  current: ContinuousScrollLayoutHeights,
  next: ContinuousScrollLayoutHeights,
): boolean => (
  current.header === next.header
  && current.footer === next.footer
  && current.border === next.border
);
