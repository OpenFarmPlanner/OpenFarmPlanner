import { Divider, Menu, MenuItem } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import DeleteIcon from '@mui/icons-material/Delete';
import type { TFunction } from 'i18next';

interface CropHeaderActionsMenuProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onOpenHistory: () => void;
  onExport: () => void;
  onDelete: () => void;
  t: TFunction<'crops'>;
}

/**
 * Presentational overflow menu for the crop detail header (versions, export,
 * delete). Anchor state lives in CropDetail.tsx; each item closes the menu
 * before running its action. The public-library publish/update action is not
 * here — it sits as a permanent button in the badge row (see CropDetail.tsx).
 */
export function CropHeaderActionsMenu({
  anchorEl,
  onClose,
  onOpenHistory,
  onExport,
  onDelete,
  t,
}: CropHeaderActionsMenuProps) {
  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
    >
      <MenuItem onClick={() => { onClose(); onOpenHistory(); }}>
        <HistoryIcon sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
        {t('buttons.versions')}
      </MenuItem>
      <Divider sx={{ my: 0.5 }} />
      <MenuItem onClick={() => { onClose(); onExport(); }}>
        <FileDownloadOutlinedIcon sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
        {t('buttons.exportCrop')}
      </MenuItem>
      <Divider sx={{ my: 0.5 }} />
      <MenuItem onClick={() => { onClose(); onDelete(); }} sx={{ color: 'error.main' }}>
        <DeleteIcon sx={{ fontSize: 18, mr: 1, color: 'error.main' }} />
        {t('buttons.delete')}
      </MenuItem>
    </Menu>
  );
}
