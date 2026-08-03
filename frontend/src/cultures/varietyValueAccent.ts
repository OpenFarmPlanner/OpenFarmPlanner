import { alpha } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';

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
