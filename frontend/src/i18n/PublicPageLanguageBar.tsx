/**
 * Right-aligned language switcher row for public pages.
 *
 * Present but not dominant: it sits above the page content, uses the page's
 * own text colour, and never competes with the primary call to action.
 */

import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';

import { PublicLanguageSwitcher } from './LanguageSwitcher';

export default function PublicPageLanguageBar({ sx }: { sx?: SxProps<Theme> }) {
  return (
    <Box sx={[{ display: 'flex', justifyContent: 'flex-end' }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <PublicLanguageSwitcher dense />
    </Box>
  );
}
