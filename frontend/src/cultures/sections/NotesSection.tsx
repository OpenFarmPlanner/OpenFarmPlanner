/**
 * NotesSection: multiline notes field.
 * @remarks Presentational, no internal state
 */
import { Typography, TextField } from '@mui/material';
import type { Culture } from '../../api/types';
import type { TFunction } from 'i18next';

interface NotesSectionProps {
  formData: Partial<Culture>;
  errors: Record<string, string>;
  onChange: <K extends keyof Culture>(name: K, value: Culture[K]) => void;
  t: TFunction;
}

export function NotesSection({ formData, onChange, t }: NotesSectionProps) {
  return (
    <>
      <Typography variant="h6" sx={{ mt: 2 }}>{t('form.notes')}</Typography>
      <TextField
        fullWidth
        multiline
        minRows={3}
        maxRows={30}
        label={t('form.notes')}
        placeholder={t('form.notesPlaceholder')}
        value={formData.notes}
        onChange={e => onChange('notes', e.target.value)}
      />
    </>
  );
}
