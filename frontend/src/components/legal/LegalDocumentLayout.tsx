/**
 * Shared shell for the legal documents (imprint, privacy policy, terms).
 *
 * The language switcher is pinned to the top-right corner of the document
 * container instead of sitting in a row of its own: it is taken out of the
 * document flow, so it costs no vertical space and cannot push or shift the
 * centred title. The container's top padding is only large enough to clear the
 * pinned switcher, which keeps the document starting as high as the switcher
 * allows without ever overlapping the title on narrow screens.
 */

import type { ReactNode } from 'react';
import { Container, Stack, Typography } from '@mui/material';

import PublicPageLanguageBar from '../../i18n/PublicPageLanguageBar';

/**
 * Distance in px from the container's top/right edge to the switcher (`top` and
 * `right` are not spacing-aware in `sx`). Together with the switcher's 44px
 * touch target this defines how far down the title can start.
 */
const languageSwitcherSx = {
  position: 'absolute',
  top: { xs: 8, sm: 12, md: 16 },
  right: { xs: 8, sm: 12, md: 16 },
  zIndex: 1,
  '@media print': { display: 'none' },
} as const;

/** Clears the pinned switcher (top offset + its 44px height) with a little air. */
const documentSx = {
  position: 'relative',
  pt: { xs: 7, sm: 7.5, md: 8 },
  pb: { xs: 6, md: 9 },
} as const;

/**
 * The German titles are single long words ("Nutzungsbedingungen"), so the
 * heading scales down on phones instead of overflowing the viewport.
 */
const titleSx = {
  textAlign: 'center',
  fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' },
  overflowWrap: 'anywhere',
} as const;

interface LegalDocumentLayoutProps {
  title: string;
  /** Centred under the title, e.g. the print action or a cross-reference link. */
  actions?: ReactNode;
  children: ReactNode;
}

export default function LegalDocumentLayout({ title, actions, children }: LegalDocumentLayoutProps) {
  return (
    <Container maxWidth="md" sx={documentSx}>
      <PublicPageLanguageBar sx={languageSwitcherSx} />
      <Stack spacing={3}>
        <Stack spacing={2} alignItems="center">
          <Typography variant="h3" component="h1" sx={titleSx}>
            {title}
          </Typography>
          {actions}
        </Stack>
        {children}
      </Stack>
    </Container>
  );
}
