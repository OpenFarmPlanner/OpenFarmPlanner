import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RichTextEditor } from '../components/data-grid/RichTextEditor';
import { normalizeRichTextMarkdown } from '../components/data-grid/richText';

vi.mock('../i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      'fields.notes': 'Notizen',
      'notesDrawer.markdownToolbar.ariaLabel': 'Formatierungsleiste',
      'notesDrawer.markdownToolbar.boldTooltip': 'Fettdruck',
      'notesDrawer.markdownToolbar.bold': 'Fettdruck',
      'notesDrawer.markdownToolbar.italicTooltip': 'Kursiv',
      'notesDrawer.markdownToolbar.italic': 'Kursiv',
      'notesDrawer.markdownToolbar.code': 'Code',
      'notesDrawer.markdownToolbar.heading': 'Überschrift',
      'notesDrawer.markdownToolbar.bulletList': 'Aufzählungsliste',
      'notesDrawer.markdownToolbar.numberedList': 'Nummerierte Liste',
      'notesDrawer.markdownToolbar.link': 'Link einfügen',
      'notesDrawer.markdownToolbar.quote': 'Zitat',
    })[key] ?? key,
  }),
}));

describe('RichTextEditor', () => {
  it('renders the shared rich-text toolbar and editor surface', () => {
    render(<RichTextEditor value="## Titel" onChange={vi.fn()} autoFocus={false} ariaLabel="Notizen" />);

    expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Formatierungsleiste' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fettdruck' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Link einfügen' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Notizen' })).toBeInTheDocument();
  });

  it('normalizes editor-only empty placeholders to an empty note', () => {
    expect(normalizeRichTextMarkdown('<p><br></p>')).toBe('');
    expect(normalizeRichTextMarkdown('<p></p>')).toBe('');
    expect(normalizeRichTextMarkdown('## Titel')).toBe('## Titel');
  });
});
