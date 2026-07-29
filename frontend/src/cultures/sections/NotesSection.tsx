import { Box, Typography } from '@mui/material';
import type { Culture } from '../../api/types';
import type { TFunction } from 'i18next';
import { RichTextEditor } from '../../components/data-grid/RichTextEditor';

interface NotesSectionProps {
  formData: Partial<Culture>;
  errors: Record<string, string>;
  onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
  t: TFunction;
  label?: string;
}

export function NotesSection({ formData, onChange, t, label }: NotesSectionProps) {
  const editorLabel = label ?? t('form.notes');

  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>{editorLabel}</Typography>
      <RichTextEditor
        value={formData.notes ?? ''}
        onChange={(markdown) => onChange('notes', markdown)}
        autoFocus={false}
        ariaLabel={editorLabel}
      />
    </Box>
  );
}
