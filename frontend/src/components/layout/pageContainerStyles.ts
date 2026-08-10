/**
 * Tailwind class lists for the page shells.
 *
 * Kept next to PageContainer rather than inlined so that the few places which
 * render a page shell without going through the component (FieldsBedsHierarchy)
 * cannot drift away from it.
 */

/**
 * Device safe-area insets, applied below `sm` in place of the fixed gutter so
 * content clears a notch in landscape.
 *
 * These use the physical `pl-`/`pr-` utilities on purpose:
 * `env(safe-area-inset-left)` is a physical measurement, so pairing it with the
 * logical `ps-`/`pe-` utilities would put the left inset on the right edge once
 * the document direction is RTL.
 */
const SAFE_AREA_GUTTER =
  'max-sm:pl-[env(safe-area-inset-left,0px)] max-sm:pr-[env(safe-area-inset-right,0px)]';

/** Horizontal page gutter, replaced by the safe-area insets below `sm`. */
const PAGE_GUTTER = `px-2 ${SAFE_AREA_GUTTER}`;

/** Centers the shell in the viewport, edge to edge below `sm`. */
const CENTERED = 'mx-auto max-sm:mx-0';

const SHELL = 'w-full box-border';

const CENTERED_PAGE = `${SHELL} max-w-page ${PAGE_GUTTER} ${CENTERED}`;

/**
 * Full workspace width for data-heavy pages. RootLayout's <main> owns the page
 * gutter at these widths, so the shell itself adds none — below `md` the gutter
 * comes back, matching the pre-Tailwind stylesheet.
 */
const WORKSPACE_PAGE = `${SHELL} max-w-none m-0 p-0 max-md:px-2 ${SAFE_AREA_GUTTER}`;

export type PageContainerVariant =
  | 'standardCenteredPage'
  | 'compactCenteredPage'
  | 'workspacePage'
  | 'standard'
  | 'wide'
  | 'workspace'
  | 'xwide'
  | 'full'
  | 'wideWorkspace'
  | 'compactCenteredTable';

export const PAGE_CONTAINER_CLASSES: Record<PageContainerVariant, string> = {
  // Recommended categories:
  // - standardCenteredPage: default readable centered page width
  // - compactCenteredPage: compact, centered pages (e.g. Suppliers)
  // - workspacePage: full workspace width for data-heavy pages (e.g. Planting Plans, Gantt)
  standardCenteredPage: CENTERED_PAGE,
  workspacePage: WORKSPACE_PAGE,
  compactCenteredPage: CENTERED_PAGE,
  // Legacy aliases kept for compatibility with older pages.
  wideWorkspace: WORKSPACE_PAGE,
  compactCenteredTable: CENTERED_PAGE,
  standard: CENTERED_PAGE,
  wide: `${SHELL} max-w-page-wide ${PAGE_GUTTER} ${CENTERED}`,
  workspace: `${SHELL} max-w-[min(1800px,calc(100vw-48px))] ${PAGE_GUTTER} ${CENTERED}`,
  xwide: `${SHELL} max-w-page-xwide ${PAGE_GUTTER} ${CENTERED}`,
  full: `${SHELL} ${PAGE_GUTTER}`,
};
