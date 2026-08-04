import { alpha } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';

export const varietySpecificValueHighlightSx = {
  display: 'inline-block',
  width: 'fit-content',
  maxWidth: '100%',
  px: 0.5,
  py: 0.125,
  mx: -0.5,
  borderRadius: 0.75,
  backgroundColor: (theme: Theme) => alpha(theme.palette.primary.light, 0.1),
  color: 'inherit',
  overflowWrap: 'anywhere',
  boxDecorationBreak: 'clone',
  WebkitBoxDecorationBreak: 'clone',
} as const;

/**
 * Same highlight color/background as `varietySpecificValueHighlightSx`, adapted for
 * form inputs (TextField/Select) instead of static text. Applies to the input's own
 * background so it stays visible even when the field is disabled/read-only.
 */
export const varietySpecificFieldHighlightSx = {
  borderRadius: 1,
  '& .MuiOutlinedInput-root, & .MuiFilledInput-root, & .MuiInputBase-root': {
    backgroundColor: (theme: Theme) => alpha(theme.palette.primary.light, 0.1),
  },
} as const;

/** Combines a field's base layout `sx` with the variety highlight `sx`, when present. */
export function mergeVarietyFieldSx(base: SxProps<Theme>, overrideSx: SxProps<Theme> | undefined): SxProps<Theme> {
  return overrideSx ? [base, overrideSx] as SxProps<Theme> : base;
}
