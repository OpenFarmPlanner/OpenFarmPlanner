import type { SxProps, Theme } from '@mui/material/styles';

/**
 * Where a Sorte's guide line sits and how far its row is indented, in theme
 * spacing units. The line runs between the Kultur header's icon and the Sorte's
 * own icon, so the two values move together.
 */
const VARIETY_GUIDE_LINE_INSET = 2.5;
const VARIETY_INDENT = 5;

/**
 * Padding and layout on an option have to be written as `&.MuiAutocomplete-option`:
 * Autocomplete styles its options through a descendant selector on the listbox,
 * which out-specifies a plain `sx` rule and would keep its own padding.
 */
export const cultureSearchGroupSx: SxProps<Theme> = {
  listStyle: 'none',
  p: 0,
};

export const cultureSearchHeaderOptionSx: SxProps<Theme> = {
  '&.MuiAutocomplete-option, &': {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
  },
};

export const cultureSearchHeaderNameSx: SxProps<Theme> = {
  fontWeight: 'bold',
  flexGrow: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

/**
 * Indents the Sorte and draws the thin line back up to its Kultur header: a
 * vertical line down the row plus a short horizontal stub into it. On the
 * last Sorte of a group the vertical line stops at the stub, so the guide
 * reads as an elbow closing off the group instead of continuing past it.
 */
export const cultureSearchVarietyOptionSx: SxProps<Theme> = {
  '&.MuiAutocomplete-option': {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    pl: VARIETY_INDENT,
    position: 'relative',
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    left: (theme: Theme) => theme.spacing(VARIETY_GUIDE_LINE_INSET),
    top: 0,
    bottom: 0,
    width: '1px',
    bgcolor: 'surface.surfaceBorder',
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    left: (theme: Theme) => theme.spacing(VARIETY_GUIDE_LINE_INSET),
    top: '50%',
    width: (theme: Theme) => theme.spacing(1.25),
    height: '1px',
    bgcolor: 'surface.surfaceBorder',
  },
};

export const cultureSearchVarietyOptionLastSx: SxProps<Theme> = {
  ...cultureSearchVarietyOptionSx,
  '&::before': {
    content: '""',
    position: 'absolute',
    left: (theme: Theme) => theme.spacing(VARIETY_GUIDE_LINE_INSET),
    top: 0,
    bottom: '50%',
    width: '1px',
    bgcolor: 'surface.surfaceBorder',
  },
};

export const cultureSearchVarietyNameSx: SxProps<Theme> = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
