import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';

export interface ImportConflictDialogProps {
  open: boolean;
  cultureName: string;
  busy: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
  onCancel: () => void;
  onUpdate: () => void;
  onImportAsNew: () => void;
}

/**
 * Shown when re-importing a public culture that's already linked to a
 * project culture with local edits — updating and importing-as-new are both
 * valid, mutually exclusive choices, so this offers explicit buttons for
 * each instead of a single confirm/cancel pair.
 */
export function ImportConflictDialog({
  open,
  cultureName,
  busy,
  t,
  onCancel,
  onUpdate,
  onImportAsNew,
}: ImportConflictDialogProps) {
  return (
    <Dialog open={open} onClose={busy ? undefined : onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{t('library.importConflictDialog.title')}</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          {t('library.importConflictDialog.message', { name: cultureName })}
        </Typography>
        <Alert severity="warning">
          {t('library.importConflictDialog.updateWarning')}
        </Alert>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, flexWrap: 'wrap', gap: 1 }}>
        {/* autoFocus on cancel so a reflexive Enter never triggers the destructive "update" action below. */}
        <Button autoFocus variant="outlined" onClick={onCancel} disabled={busy}>
          {t('common:actions.cancel')}
        </Button>
        <Button variant="outlined" onClick={onImportAsNew} disabled={busy}>
          {t('library.importConflictDialog.importAsNew')}
        </Button>
        <Button variant="contained" color="error" onClick={onUpdate} disabled={busy}>
          {t('library.importConflictDialog.update')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
