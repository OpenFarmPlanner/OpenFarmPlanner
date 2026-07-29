import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { publicCultureAPI } from '../../api/api';
import type { PublicCulture } from '../../api/types';
import { useTranslation } from '../../i18n';
import { getLanguageDisplayName } from '../../i18n/languages';

interface PublicCultureTranslationDialogProps {
  open: boolean;
  culture: PublicCulture;
  /** UI language being edited; translators work in their own language. */
  language: string;
  onClose: () => void;
  onSaved: () => void;
}

export function PublicCultureTranslationDialog({
  open,
  culture,
  language,
  onClose,
  onSaved,
}: PublicCultureTranslationDialogProps): JSX.Element {
  const { t } = useTranslation('cultures');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [originalLanguageCode, setOriginalLanguageCode] = useState('');
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [editedText, setEditedText] = useState('');

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    publicCultureAPI.getTranslations(culture.id)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setOriginalLanguageCode(response.data.original_language_code);
        setTranslations(response.data.translations);
        setEditedText(response.data.translations[language] ?? '');
      })
      .catch(() => {
        if (!cancelled) {
          setError(t('library.translation.loadError'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, culture.id, language, t]);

  const originalText = translations[originalLanguageCode] ?? culture.notes ?? '';
  const hasOwnTranslation = Boolean(translations[language]?.trim());
  // Once a translation exists for the edited language, the original text is
  // no longer shown: translators need it only until they have their own text.
  const showOriginal = !loading && language !== originalLanguageCode && !hasOwnTranslation && Boolean(originalText.trim());

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    setError('');
    try {
      await publicCultureAPI.updateTranslations(culture.id, { [language]: editedText });
      onClose();
      onSaved();
    } catch {
      setError(t('library.translation.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const languageName = getLanguageDisplayName(language, language);
  const originalLanguageName = getLanguageDisplayName(originalLanguageCode, language);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('library.translation.editDialogTitle')}</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            {showOriginal ? (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  {t('library.translation.originalSectionTitle', { language: originalLanguageName })}
                </Typography>
                <Box
                  sx={{
                    mt: 0.5,
                    p: 1.5,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'action.hover',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  <Typography variant="body2">{originalText}</Typography>
                </Box>
              </Box>
            ) : null}
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                {t('library.translation.editorSectionTitle', { language: languageName })}
              </Typography>
              <TextField
                fullWidth
                multiline
                minRows={6}
                maxRows={20}
                sx={{ mt: 0.5 }}
                value={editedText}
                onChange={(event) => setEditedText(event.target.value)}
                placeholder={t('library.translation.descriptionPlaceholder')}
              />
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>{t('form.cancel')}</Button>
        <Button variant="contained" onClick={() => void handleSave()} disabled={loading || saving}>
          {saving ? t('library.page.edit.saving') : t('library.page.edit.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
