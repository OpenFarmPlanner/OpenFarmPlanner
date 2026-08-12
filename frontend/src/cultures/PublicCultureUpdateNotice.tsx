/**
 * Surfaces a pending public-library update on a private, imported culture.
 *
 * The library's 4-case import/update model only ever ran when the user opened
 * the public library and pressed "Im Projekt aktualisieren", so a public edit
 * — a corrected Sorte in particular — stayed invisible on the culture that
 * copied it. This notice is the missing trigger: the culture list already
 * reports `public_update_available`, the field-level diff is fetched on demand,
 * and nothing is copied until the user confirms it in the dialog.
 *
 * The dialog offers three distinct outcomes: applying the update, declining it
 * for exactly this public version ("Ablehnen", which hides the notice but
 * changes nothing locally), and closing without deciding.
 */

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
import type { Culture, PublicCultureUpdateFieldChange } from '../api/types';
import {
  formatPublicCultureValue,
  getPublicCultureComparisonFieldLabel,
} from '../crops/components/publicCropLibrary/formatters';
import type { PublicCultureUpdateController } from './usePublicCultureUpdate';

interface PublicCultureUpdateNoticeProps {
  culture: Culture;
  controller: PublicCultureUpdateController;
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

export function PublicCultureUpdateNotice({ culture, controller }: PublicCultureUpdateNoticeProps) {
  const { t } = useTranslation(['cultures', 'common']);
  const {
    update,
    hasOpenUpdate,
    isLoading,
    isApplying,
    isRejecting,
    openDiff,
    closeDiff,
    applyUpdate,
    rejectUpdate,
  } = controller;

  const changes: PublicCultureUpdateFieldChange[] = update?.changes ?? [];
  const varietyChange = changes.find((change) => change.field === 'variety');
  const otherChanges = changes.filter((change) => change.field !== 'variety');
  const isBusy = isApplying || isRejecting;

  return (
    <>
      {hasOpenUpdate ? (
        <Alert
          severity="info"
          icon={<SyncOutlinedIcon fontSize="small" />}
          data-testid="culture-public-update-notice"
          sx={{ mt: 1.5 }}
          action={(
            <Button
              color="inherit"
              size="small"
              onClick={openDiff}
              disabled={isLoading}
            >
              {isLoading ? t('library.publicUpdate.loading') : t('library.publicUpdate.review')}
            </Button>
          )}
        >
          {t('library.publicUpdate.notice')}
        </Alert>
      ) : null}

      <Dialog open={update !== null} onClose={closeDiff} maxWidth="sm" fullWidth>
        <DialogTitle>{t('library.publicUpdate.dialogTitle')}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            {t('library.publicUpdate.dialogDescription', {
              name: update?.public_culture_name ?? culture.name,
            })}
          </Typography>

          {update?.is_rejected ? (
            <Alert severity="info" sx={{ mb: 2 }} data-testid="culture-public-update-rejected-hint">
              {t('library.publicUpdate.rejectedHint')}
            </Alert>
          ) : null}

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
          <Button autoFocus variant="outlined" onClick={closeDiff} disabled={isBusy}>
            {t('common:actions.cancel')}
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            onClick={rejectUpdate}
            disabled={isBusy || update?.is_rejected}
            startIcon={isRejecting ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isRejecting ? t('library.publicUpdate.rejecting') : t('library.publicUpdate.reject')}
          </Button>
          <Button
            variant="contained"
            color={update?.has_local_changes ? 'error' : 'primary'}
            onClick={applyUpdate}
            disabled={isBusy}
            startIcon={isApplying ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isApplying ? t('library.publicUpdate.applying') : t('library.publicUpdate.apply')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
