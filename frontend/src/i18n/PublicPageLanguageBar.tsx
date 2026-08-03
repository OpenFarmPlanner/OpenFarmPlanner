/**
 * Right-aligned language switcher for public pages.
 *
 * Present but not dominant: it uses the page's own text colour and can sit
 * either in a page header row or in a standalone row.
 */

import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';

import { PublicLanguageSwitcher } from './LanguageSwitcher';

interface PublicPageLanguageBarProps {
  sx?: SxProps<Theme>;
  buttonSx?: SxProps<Theme>;
}

export default function PublicPageLanguageBar({ sx, buttonSx }: PublicPageLanguageBarProps) {
  return (
    <Box sx={[{ display: 'flex', justifyContent: 'flex-end' }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <PublicLanguageSwitcher dense sx={buttonSx} />
    </Box>
  );
}
