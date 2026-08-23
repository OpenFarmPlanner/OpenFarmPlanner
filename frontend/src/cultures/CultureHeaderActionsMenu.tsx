import { Box, Divider, Menu, MenuItem } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import PublicIcon from '@mui/icons-material/Public';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import DeleteIcon from '@mui/icons-material/Delete';
import type { TFunction } from 'i18next';
import { AppTooltip } from '../components/AppTooltip';

interface CultureHeaderActionsMenuProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onOpenHistory: () => void;
  onExport: () => void;
  onPublish: () => void;
  isPublishing: boolean;
  publishLabel: string;
  /**
   * Localized explanation why publishing is currently locked. When set, the
   * publish item is disabled and the reason is shown as its tooltip.
   */
  publishBlockedTooltip?: string;
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
  onExport,
  onPublish,
  isPublishing,
  publishLabel,
  publishBlockedTooltip,
  onDelete,
  t,
}: CultureHeaderActionsMenuProps) {
  const publishItem = (
    <MenuItem
      onClick={() => { onClose(); onPublish(); }}
      disabled={isPublishing || Boolean(publishBlockedTooltip)}
      sx={{ color: 'text.primary' }}
    >
      <PublicIcon sx={{ fontSize: 18, mr: 1, color: 'rgba(37, 111, 42, 0.78)' }} />
      {publishLabel}
    </MenuItem>
  );

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
      {publishBlockedTooltip ? (
        // A disabled MenuItem fires no pointer events, so the tooltip needs a
        // wrapper element to hang off — the same pattern DetailPageActions uses
        // for disabled actions. The wrapper stays block-level so the item keeps
        // the menu's full width on every breakpoint.
        <AppTooltip title={publishBlockedTooltip}>
          <Box component="span" sx={{ display: 'block' }}>{publishItem}</Box>
        </AppTooltip>
      ) : publishItem}
      <Divider sx={{ my: 0.5 }} />
      <MenuItem onClick={() => { onClose(); onExport(); }}>
        <FileDownloadOutlinedIcon sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
        {t('buttons.exportCulture')}
      </MenuItem>
      <Divider sx={{ my: 0.5 }} />
      <MenuItem onClick={() => { onClose(); onDelete(); }} sx={{ color: 'error.main' }}>
        <DeleteIcon sx={{ fontSize: 18, mr: 1, color: 'error.main' }} />
        {t('buttons.delete')}
      </MenuItem>
    </Menu>
  );
}
