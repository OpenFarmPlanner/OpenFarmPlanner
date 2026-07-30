import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown, type MarkdownStorage } from 'tiptap-markdown';
import { Box, Divider, IconButton, Tooltip } from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import CodeIcon from '@mui/icons-material/Code';
import TitleIcon from '@mui/icons-material/Title';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import LinkIcon from '@mui/icons-material/Link';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import { useTranslation } from '../../i18n';
import { normalizeRichTextMarkdown } from './richText';

export interface RichTextEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  focusRequestId?: number;
  autoFocus?: boolean;
  minHeight?: number;
  ariaLabel?: string;
}

const toolbarSx = {
  display: 'flex',
  gap: 0.5,
  p: 0.75,
  borderBottom: 1,
  borderColor: 'divider',
  backgroundColor: 'background.paper',
  flexWrap: 'wrap',
};

const editorWrapperSx = (minHeight: number) => ({
  border: 1,
  borderColor: 'divider',
  borderRadius: 1,
  overflow: 'hidden',
  maxWidth: '100%',
  '&:focus-within': {
    borderColor: 'primary.main',
    outline: '1px solid',
    outlineColor: 'primary.main',
  },
  '& .ProseMirror': {
    minHeight,
    p: 1.5,
    outline: 'none',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    lineHeight: 1.6,
    overflowWrap: 'anywhere',
  },
  '& .ProseMirror h1': { fontSize: '1.5rem', fontWeight: 600, mt: 1, mb: 0.5 },
  '& .ProseMirror h2': { fontSize: '1.25rem', fontWeight: 600, mt: 1, mb: 0.5 },
  '& .ProseMirror h3': { fontSize: '1.1rem', fontWeight: 600, mt: 1, mb: 0.5 },
  '& .ProseMirror ul, & .ProseMirror ol': { pl: 3, my: 0.5 },
  '& .ProseMirror li': { mb: 0.25 },
  '& .ProseMirror blockquote': {
    borderLeft: '3px solid',
    borderColor: 'divider',
    pl: 2,
    ml: 0,
    my: 1,
    color: 'text.secondary',
  },
  '& .ProseMirror code': {
    fontFamily: 'monospace',
    fontSize: '0.875em',
    backgroundColor: 'action.hover',
    px: 0.5,
    borderRadius: 0.5,
  },
  '& .ProseMirror pre': {
    backgroundColor: 'action.hover',
    borderRadius: 1,
    p: 1.5,
    my: 1,
    overflow: 'auto',
    '& code': { backgroundColor: 'transparent', p: 0 },
  },
  '& .ProseMirror a': { color: 'primary.main', textDecoration: 'underline' },
  '& .ProseMirror p': { my: 0.5 },
  '& .ProseMirror p:first-of-type': { mt: 0 },
});

export function RichTextEditor({
  value,
  onChange,
  focusRequestId = 0,
  autoFocus = true,
  minHeight = 180,
  ariaLabel,
}: RichTextEditorProps) {
  const { t } = useTranslation('common');
  const openMarker = useRef(-1);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          autolink: false,
          HTMLAttributes: { rel: 'noopener noreferrer' },
        },
      }),
      Markdown.configure({ html: false, tightLists: true, transformPastedText: true }),
    ],
    content: '',
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': ariaLabel ?? t('fields.notes'),
      },
    },
    onUpdate({ editor: nextEditor }) {
      if (nextEditor.isDestroyed) return;
      const markdownStorage = (nextEditor.storage as unknown as { markdown: MarkdownStorage }).markdown;
      onChange(normalizeRichTextMarkdown(markdownStorage.getMarkdown()));
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed || focusRequestId === openMarker.current) return;
    openMarker.current = focusRequestId;
    editor.commands.setContent(normalizeRichTextMarkdown(value), { emitUpdate: false });
    if (autoFocus) {
      editor.commands.focus('end');
    }
  }, [editor, focusRequestId, value, autoFocus]);

  const handleSetLink = (): void => {
    if (!editor) return;
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt(t('notesDrawer.markdownToolbar.link'), previous ?? '');
    if (url === null) return;
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  return (
    <Box sx={editorWrapperSx(minHeight)} data-testid="rich-text-editor">
      <Box sx={toolbarSx} role="toolbar" aria-label={t('notesDrawer.markdownToolbar.ariaLabel')}>
        <Tooltip title={t('notesDrawer.markdownToolbar.boldTooltip')}>
          <IconButton size="small" onMouseDown={(event) => { event.preventDefault(); editor?.chain().focus().toggleBold().run(); }} aria-label={t('notesDrawer.markdownToolbar.bold')} aria-pressed={editor?.isActive('bold') ?? false}>
            <FormatBoldIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('notesDrawer.markdownToolbar.italicTooltip')}>
          <IconButton size="small" onMouseDown={(event) => { event.preventDefault(); editor?.chain().focus().toggleItalic().run(); }} aria-label={t('notesDrawer.markdownToolbar.italic')} aria-pressed={editor?.isActive('italic') ?? false}>
            <FormatItalicIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('notesDrawer.markdownToolbar.code')}>
          <IconButton size="small" onMouseDown={(event) => { event.preventDefault(); editor?.chain().focus().toggleCode().run(); }} aria-label={t('notesDrawer.markdownToolbar.code')} aria-pressed={editor?.isActive('code') ?? false}>
            <CodeIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Tooltip title={t('notesDrawer.markdownToolbar.heading')}>
          <IconButton size="small" onMouseDown={(event) => { event.preventDefault(); editor?.chain().focus().toggleHeading({ level: 2 }).run(); }} aria-label={t('notesDrawer.markdownToolbar.heading')} aria-pressed={editor?.isActive('heading', { level: 2 }) ?? false}>
            <TitleIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('notesDrawer.markdownToolbar.bulletList')}>
          <IconButton size="small" onMouseDown={(event) => { event.preventDefault(); editor?.chain().focus().toggleBulletList().run(); }} aria-label={t('notesDrawer.markdownToolbar.bulletList')} aria-pressed={editor?.isActive('bulletList') ?? false}>
            <FormatListBulletedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('notesDrawer.markdownToolbar.numberedList')}>
          <IconButton size="small" onMouseDown={(event) => { event.preventDefault(); editor?.chain().focus().toggleOrderedList().run(); }} aria-label={t('notesDrawer.markdownToolbar.numberedList')} aria-pressed={editor?.isActive('orderedList') ?? false}>
            <FormatListNumberedIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Tooltip title={t('notesDrawer.markdownToolbar.link')}>
          <IconButton size="small" onMouseDown={(event) => { event.preventDefault(); handleSetLink(); }} aria-label={t('notesDrawer.markdownToolbar.link')} aria-pressed={editor?.isActive('link') ?? false}>
            <LinkIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('notesDrawer.markdownToolbar.quote')}>
          <IconButton size="small" onMouseDown={(event) => { event.preventDefault(); editor?.chain().focus().toggleBlockquote().run(); }} aria-label={t('notesDrawer.markdownToolbar.quote')} aria-pressed={editor?.isActive('blockquote') ?? false}>
            <FormatQuoteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <EditorContent editor={editor} />
    </Box>
  );
}
