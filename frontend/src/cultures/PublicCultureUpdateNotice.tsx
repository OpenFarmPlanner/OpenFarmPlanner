/**
 * Surfaces a pending public-library update on a private, imported culture.
 *
 * The library's 4-case import/update model only ever ran when the user opened
 * the public library and pressed "Im Projekt aktualisieren", so a public edit
 * — a corrected Sorte in particular — stayed invisible on the culture that
 * copied it. This notice is the missing trigger: the culture list already
 * reports `public_update_available`, the field-level diff is fetched on demand,
 * and nothing is copied until the user confirms it in the dialog.
 */

import { useCallback, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import { useTranslation } from '../i18n';
import { cultureAPI, publicCultureAPI } from '../api/api';
import type { Culture, CulturePublicUpdate, PublicCultureUpdateFieldChange } from '../api/types';
import {
  formatPublicCultureValue,
  getPublicCultureComparisonFieldLabel,
} from '../crops/components/publicCropLibrary/formatters';
import { showGlobalSnackbar } from '../utils/globalSnackbar';

interface PublicCultureUpdateNoticeProps {
  culture: Culture;
  /** Called after the update was applied, so the page can reload its cultures. */
  onUpdated?: () => void;
}

const DIFF_ROW_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'minmax(8rem, 0.8fr) 1fr 1fr' },
  gap: { xs: 0.5, sm: 1.5 },
  px: 2,
  py: 1,
  borderTop: '1px solid',
  borderColor: 'divider',
} as const;

export function PublicCultureUpdateNotice({ culture, onUpdated }: PublicCultureUpdateNoticeProps) {
  const { t } = useTranslation(['cultures', 'common']);
  const [update, setUpdate] = useState<CulturePublicUpdate | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  const handleOpen = useCallback(async (): Promise<void> => {
    if (!culture.id) {
      return;
    }
    setLoading(true);
    try {
      const response = await cultureAPI.publicUpdate(culture.id);
      if (!response.data.available) {
        // The entry moved on (or back) between the list load and this click.
        showGlobalSnackbar({ message: t('library.publicUpdate.gone'), severity: 'info' });
        onUpdated?.();
        return;
      }
      setUpdate(response.data);
    } catch {
      showGlobalSnackbar({ message: t('library.publicUpdate.loadError'), severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, [culture.id, onUpdated, t]);

  const handleClose = useCallback((): void => {
    if (applying) {
      return;
    }
    setUpdate(null);
  }, [applying]);

  const handleApply = useCallback(async (): Promise<void> => {
    if (!update?.public_culture_id) {
      return;
    }
    setApplying(true);
    try {
      await publicCultureAPI.importToProject(update.public_culture_id, 'update');
      showGlobalSnackbar({
        message: t('library.publicUpdate.applied', { name: update.public_culture_name ?? culture.name }),
        severity: 'success',
      });
      setUpdate(null);
      onUpdated?.();
    } catch {
      showGlobalSnackbar({ message: t('library.publicUpdate.applyError'), severity: 'error' });
    } finally {
      setApplying(false);
    }
  }, [culture.name, onUpdated, t, update]);

  if (!culture.public_update_available) {
    return null;
  }

  const changes: PublicCultureUpdateFieldChange[] = update?.changes ?? [];
  const varietyChange = changes.find((change) => change.field === 'variety');
  const otherChanges = changes.filter((change) => change.field !== 'variety');

  return (
    <>
      <Alert
        severity="info"
        icon={<SyncOutlinedIcon fontSize="small" />}
        data-testid="culture-public-update-notice"
        sx={{ mt: 1.5 }}
        action={(
          <Button
            color="inherit"
            size="small"
            onClick={() => void handleOpen()}
            disabled={loading}
          >
            {loading ? t('library.publicUpdate.loading') : t('library.publicUpdate.review')}
          </Button>
        )}
      >
        {t('library.publicUpdate.notice')}
      </Alert>

      <Dialog open={update !== null} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{t('library.publicUpdate.dialogTitle')}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            {t('library.publicUpdate.dialogDescription', {
              name: update?.public_culture_name ?? culture.name,
            })}
          </Typography>

          {varietyChange ? (
            <Alert severity="info" sx={{ mb: 2 }} data-testid="culture-public-update-variety-change">
              {t('library.importConflictDialog.varietyRenamed', {
                from: formatPublicCultureValue('variety', varietyChange.local_value, t),
                to: formatPublicCultureValue('variety', varietyChange.public_value, t),
              })}
            </Alert>
          ) : null}

          {otherChanges.length ? (
            <Box
              aria-label={t('library.publicUpdate.changesAriaLabel')}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}
            >
              <Box sx={{ ...DIFF_ROW_SX, borderTop: 'none', bgcolor: 'action.hover' }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }} />
                <Typography variant="caption" color="text.secondary">
                  {t('library.publicUpdate.localValue')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('library.publicUpdate.publicValue')}
                </Typography>
              </Box>
              <Box component="dl" sx={{ m: 0 }}>
                {otherChanges.map((change) => (
                  <Box key={change.field} sx={DIFF_ROW_SX}>
                    <Typography component="dt" variant="body2" sx={{ fontWeight: 600 }}>
                      {getPublicCultureComparisonFieldLabel(change.field, t)}
                    </Typography>
                    <Typography component="dd" variant="body2" sx={{ m: 0, color: 'text.secondary' }}>
                      {formatPublicCultureValue(change.field, change.local_value, t)}
                    </Typography>
                    <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                      {formatPublicCultureValue(change.field, change.public_value, t)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          ) : null}

          {update?.has_local_changes ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              {t('library.importConflictDialog.updateWarning')}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, flexWrap: 'wrap', gap: 1 }}>
          {/* autoFocus on cancel so a reflexive Enter never overwrites the local copy. */}
          <Button autoFocus variant="outlined" onClick={handleClose} disabled={applying}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant="contained"
            color={update?.has_local_changes ? 'error' : 'primary'}
            onClick={() => void handleApply()}
            disabled={applying}
            startIcon={applying ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {applying ? t('library.publicUpdate.applying') : t('library.publicUpdate.apply')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
