export const formRowSx = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 2,
  alignItems: 'flex-start',
} as const;

const responsiveFieldWidth = (desktopWidth: number) => ({
  width: { xs: '100%', sm: desktopWidth },
  maxWidth: { xs: '100%', sm: desktopWidth },
  flex: { xs: '1 1 100%', sm: `0 1 ${desktopWidth}px` },
  minWidth: 0,
  alignItems: 'flex-start',
} as const);

/** Numbers, dates, versions, priorities, and other short values. */
export const compactFieldSx = responsiveFieldWidth(180);

/** Short option sets such as status, units, and cultivation methods. */
export const smallFieldSx = responsiveFieldWidth(224);

/** Families, suppliers, coordinates, and other moderately long values. */
export const mediumFieldSx = responsiveFieldWidth(300);

/** Names, email addresses, URLs, and other potentially long single-line values. */
export const wideFieldSx = responsiveFieldWidth(400);

/**
 * Multiline fields stacked vertically (not inside `formRowSx`'s row flex).
 * Plain width/maxWidth only - the `flex` shorthand from `responsiveFieldWidth`
 * sets the *main-axis* size, which is height inside a column Stack, and would
 * stretch a multiline field's box to that height instead of constraining its width.
 */
export const wideStackedFieldSx = {
  width: { xs: '100%', sm: 460 },
  maxWidth: '100%',
} as const;

/** Descriptions, notes, comments, and fields that deliberately span their row. */
export const fullWidthFieldSx = {
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  flex: '1 1 100%',
  alignItems: 'flex-start',
} as const;
