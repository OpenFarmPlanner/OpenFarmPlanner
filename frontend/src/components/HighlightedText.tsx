import { Box } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import type { ReactElement, ReactNode } from 'react';

interface HighlightedTextProps {
  text: string;
  /**
   * The needle to mark inside `text`, already trimmed and lower-cased. An
   * empty needle — or one that does not occur in `text` — renders `text`
   * unchanged.
   */
  query: string;
}

const matchSx = {
  bgcolor: (theme: Theme) => alpha(theme.palette.primary.main, 0.16),
  color: 'primary.dark',
  fontWeight: 700,
  borderRadius: 0.5,
};

/**
 * Renders `text` with every occurrence of `query` marked.
 *
 * Matching runs on the lower-cased text, so the marked slices are taken from
 * the original string by offset. A lowercasing that changes the string length
 * (Turkish dotted capital I, for one) would shift those offsets onto the wrong
 * characters, so that case falls back to plain, unmarked text.
 */
export function HighlightedText({ text, query }: HighlightedTextProps): ReactElement {
  const lowerText = text.toLowerCase();
  if (!query || lowerText.length !== text.length || !lowerText.includes(query)) {
    return <>{text}</>;
  }

  const segments: ReactNode[] = [];
  let cursor = 0;
  let matchStart = lowerText.indexOf(query);
  while (matchStart !== -1) {
    if (matchStart > cursor) {
      segments.push(text.slice(cursor, matchStart));
    }
    segments.push(
      <Box component="mark" key={matchStart} sx={matchSx}>
        {text.slice(matchStart, matchStart + query.length)}
      </Box>,
    );
    cursor = matchStart + query.length;
    matchStart = lowerText.indexOf(query, cursor);
  }
  if (cursor < text.length) {
    segments.push(text.slice(cursor));
  }

  return <>{segments}</>;
}
