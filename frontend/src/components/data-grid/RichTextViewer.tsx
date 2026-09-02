import { Box, Typography } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from '../../i18n';
import { markdownComponents } from './markdownComponents';

interface RichTextViewerProps {
  value: string;
  emptyLabel?: string;
}

const viewerSx = {
  overflowWrap: 'anywhere',
  '& p': { my: 0.75 },
  '& p:first-of-type': { mt: 0 },
  '& p:last-child': { mb: 0 },
  '& h1': { fontSize: '1.5rem', fontWeight: 600, mt: 1, mb: 0.5 },
  '& h2': { fontSize: '1.25rem', fontWeight: 600, mt: 1, mb: 0.5 },
  '& h3': { fontSize: '1.1rem', fontWeight: 600, mt: 1, mb: 0.5 },
  '& ul, & ol': { pl: 3, my: 0.75 },
  '& li': { mb: 0.25 },
  '& blockquote': {
    borderLeft: '3px solid',
    borderColor: 'divider',
    pl: 2,
    ml: 0,
    my: 1,
    color: 'text.secondary',
  },
  '& code': {
    fontFamily: 'monospace',
    fontSize: '0.875em',
    backgroundColor: 'action.hover',
    px: 0.5,
    borderRadius: 0.5,
  },
  '& pre': {
    backgroundColor: 'action.hover',
    borderRadius: 1,
    p: 1.5,
    my: 1,
    overflow: 'auto',
    '& code': { backgroundColor: 'transparent', p: 0 },
  },
  '& a': { color: 'primary.main', textDecoration: 'underline' },
};

export function RichTextViewer({ value, emptyLabel }: RichTextViewerProps) {
  const { t } = useTranslation('common');
  const text = value.trim();

  if (!text) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic", }} >
        {emptyLabel ?? t('notes.empty')}
      </Typography>
    );
  }

  return (
    <Box sx={viewerSx} data-testid="rich-text-viewer">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ ...markdownComponents, html: () => null }}
      >
        {text}
      </ReactMarkdown>
    </Box>
  );
}
