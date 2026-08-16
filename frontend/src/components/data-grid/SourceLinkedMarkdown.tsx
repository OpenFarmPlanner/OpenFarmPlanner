import { useCallback, useEffect, useMemo, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from '../../i18n';
import { prepareSourceLinkedMarkdown } from './markdown';

interface SourceLinkedMarkdownProps {
  children: string;
  sx?: SxProps<Theme>;
  testId?: string;
}

const SOURCE_REF_PREFIX = '#ofp-source-';
const SOURCE_HEADING_RE = /^(quellen|sources)$/i;

function getSourceListItems(container: HTMLElement): HTMLElement[] {
  const headings = Array.from(container.querySelectorAll('h1,h2,h3,h4,h5,h6'));
  const sourceHeading = headings.find((heading) => SOURCE_HEADING_RE.test(heading.textContent?.trim() ?? ''));

  if (!sourceHeading) {
    return [];
  }

  let next = sourceHeading.nextElementSibling;
  while (next) {
    if (/^H[1-6]$/.test(next.tagName)) {
      return [];
    }
    if (next.matches('ol,ul')) {
      return Array.from(next.querySelectorAll(':scope > li'));
    }
    next = next.nextElementSibling;
  }

  return [];
}

const sourceLinkedMarkdownSx: SxProps<Theme> = {
  '& a[data-ofp-source-ref="true"]': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    verticalAlign: 'super',
    ml: 0.25,
    px: 0.45,
    minWidth: 16,
    minHeight: 16,
    borderRadius: 999,
    bgcolor: 'action.hover',
    color: 'primary.main',
    fontSize: '0.68em',
    fontWeight: 700,
    lineHeight: 1,
    textDecoration: 'none',
    '&:hover, &:focus-visible': {
      bgcolor: 'action.selected',
      textDecoration: 'none',
      outline: '2px solid',
      outlineColor: 'primary.light',
      outlineOffset: 1,
    },
  },
  '& [data-ofp-source-line="true"]': {
    scrollMarginTop: 96,
    borderRadius: 0.5,
    transition: 'background-color 180ms ease, outline-color 180ms ease',
  },
  '& [data-ofp-source-highlight="true"]': {
    bgcolor: 'action.selected',
    outline: '2px solid',
    outlineColor: 'primary.light',
  },
};

export function SourceLinkedMarkdown({ children, sx, testId }: SourceLinkedMarkdownProps) {
  const { t } = useTranslation('common');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);
  const prepared = useMemo(() => prepareSourceLinkedMarkdown(children), [children]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || prepared.sourceReferenceCount === 0) {
      return;
    }

    getSourceListItems(container).forEach((item, index) => {
      item.id = `ofp-source-${index + 1}`;
      item.dataset.ofpSourceLine = 'true';
    });
  }, [prepared.markdown, prepared.sourceReferenceCount]);

  useEffect(() => () => {
    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current);
    }
  }, []);

  const handleSourceClick = useCallback((event: ReactMouseEvent<HTMLAnchorElement>, href: string) => {
    event.preventDefault();

    const sourceIndex = Number(href.slice(SOURCE_REF_PREFIX.length));
    if (!Number.isInteger(sourceIndex) || sourceIndex < 1) {
      return;
    }

    const container = containerRef.current;
    const sourceLine = container ? getSourceListItems(container)[sourceIndex - 1] : null;
    if (!sourceLine) {
      return;
    }

    sourceLine.scrollIntoView({ block: 'center', behavior: 'smooth' });
    sourceLine.dataset.ofpSourceHighlight = 'true';

    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current);
    }

    highlightTimeoutRef.current = window.setTimeout(() => {
      delete sourceLine.dataset.ofpSourceHighlight;
      highlightTimeoutRef.current = null;
    }, 1800);
  }, []);

  return (
    <Box ref={containerRef} sx={[sourceLinkedMarkdownSx, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]} data-testid={testId}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, href, children: linkChildren, ...props }) => {
            void node;
            if (href?.startsWith(SOURCE_REF_PREFIX)) {
              const sourceIndex = href.slice(SOURCE_REF_PREFIX.length);
              return (
                <a
                  {...props}
                  href={href}
                  data-ofp-source-ref="true"
                  aria-label={t('notes.jumpToSource', { index: sourceIndex })}
                  onClick={(event) => handleSourceClick(event, href)}
                >
                  {linkChildren}
                </a>
              );
            }

            return <a {...props} href={href} target="_blank" rel="noopener noreferrer">{linkChildren}</a>;
          },
          html: () => null,
        }}
      >
        {prepared.markdown}
      </ReactMarkdown>
    </Box>
  );
}
