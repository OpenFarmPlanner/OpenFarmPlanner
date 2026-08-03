import { Divider, Menu, MenuItem } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import PublicIcon from '@mui/icons-material/Public';
import DeleteIcon from '@mui/icons-material/Delete';
import type { TFunction } from 'i18next';

interface CultureHeaderActionsMenuProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onOpenHistory: () => void;
  onPublish: () => void;
  isPublishing: boolean;
  publishLabel: string;
  onDelete: () => void;
  t: TFunction<'cultures'>;
}

/**
 * Presentational overflow menu for the culture detail header (versions,
 * publish to public library, delete). Anchor state lives in CultureDetail.tsx;
 * each item closes the menu before running its action, matching the original
 * inline behavior.
 */
export function CultureHeaderActionsMenu({
  anchorEl,
  onClose,
  onOpenHistory,
  onPublish,
  isPublishing,
  publishLabel,
  onDelete,
  t,
}: CultureHeaderActionsMenuProps) {
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
      <MenuItem
        onClick={() => { onClose(); onPublish(); }}
        disabled={isPublishing}
        sx={{ color: 'text.primary' }}
      >
        <PublicIcon sx={{ fontSize: 18, mr: 1, color: 'rgba(37, 111, 42, 0.78)' }} />
        {publishLabel}
      </MenuItem>
      <Divider sx={{ my: 0.5 }} />
      <MenuItem onClick={() => { onClose(); onDelete(); }} sx={{ color: 'error.main' }}>
        <DeleteIcon sx={{ fontSize: 18, mr: 1, color: 'error.main' }} />
        {t('buttons.delete')}
      </MenuItem>
    </Menu>
  );
}
