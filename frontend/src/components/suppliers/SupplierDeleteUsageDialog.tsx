import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

import { useTranslation } from '../../i18n';
import type { Supplier, SupplierDeleteUsage } from '../../api/types';

export interface SupplierDeleteUsageDialogState {
  supplier: Supplier;
  usage: SupplierDeleteUsage;
}

interface SupplierDeleteUsageDialogProps {
  /** The dialog is open while this is non-null. */
  dialog: SupplierDeleteUsageDialogState | null;
  /** The supplier id currently being unlink-deleted (disables the button). */
  unlinkDeletingSupplierId: number | null;
  onClose: () => void;
  onOpenAffectedCultures: () => void;
  onUnlinkAndDelete: () => void;
}

/**
 * Presentational dialog shown before deleting a supplier that is still
 * referenced by cultures: lists the usages and offers unlink-and-delete.
 * State and the delete/navigation handlers live in Suppliers.tsx; this
 * component only renders.
 */
export function SupplierDeleteUsageDialog({
  dialog,
  unlinkDeletingSupplierId,
  onClose,
  onOpenAffectedCultures,
  onUnlinkAndDelete,
}: SupplierDeleteUsageDialogProps) {
  const { t } = useTranslation(['suppliers', 'common']);

  return (
    <Dialog
      open={dialog !== null}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle sx={{ pb: 1 }}>{t('deleteUsageDialog.title')}</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {dialog
            ? t('deleteUsageDialog.summary', { count: dialog.usage.total_culture_count })
            : ''}
        </Typography>
        {dialog ? (
          <Box
            sx={{
              p: 2,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'surface.surfaceSoftBorder',
              bgcolor: 'surface.surfaceSubtleBackground',
            }}
          >
            <Typography sx={{ fontWeight: 700, mb: 1 }}>
              {dialog.supplier.name}
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5, color: 'text.secondary' }}>
              {dialog.usage.culture_count > 0 ? (
                <Typography component="li" variant="body2">
                  {t('deleteUsageDialog.cultureUsage', { count: dialog.usage.culture_count })}
                </Typography>
              ) : null}
              {dialog.usage.supplier_data_culture_count > 0 ? (
                <Typography component="li" variant="body2">
                  {t('deleteUsageDialog.supplierDataUsage', {
                    cultureCount: dialog.usage.supplier_data_culture_count,
                    rowCount: dialog.usage.supplier_data_count,
                  })}
                </Typography>
              ) : null}
              {dialog.usage.seed_demand_culture_count > 0 ? (
                <Typography component="li" variant="body2">
                  {t('deleteUsageDialog.seedDemandUsage', { count: dialog.usage.seed_demand_culture_count })}
                </Typography>
              ) : null}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {t('deleteUsageDialog.unlinkExplanation')}
            </Typography>
            <Button
              onClick={onOpenAffectedCultures}
              variant="text"
              size="small"
              endIcon={<ArrowForwardIcon />}
              sx={{ mt: 1, px: 0 }}
            >
              {t('deleteUsageDialog.openAffectedCultures')}
            </Button>
          </Box>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
        <Button onClick={onClose} variant="outlined">
          {t('common:actions.cancel')}
        </Button>
        <Button
          onClick={onUnlinkAndDelete}
          color="error"
          variant="contained"
          disabled={unlinkDeletingSupplierId === dialog?.supplier.id}
        >
          {t('deleteUsageDialog.unlinkAndDelete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
